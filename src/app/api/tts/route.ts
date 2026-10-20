import fs from "node:fs";
import { currentUser } from "@/lib/auth";
import { friendlyAiError, guard, logUsage } from "@/lib/ai";
import { cachedPath, isSpeakableTurkish, normalizeTtsText, synthesize, type Voice } from "@/lib/tts";

export const runtime = "nodejs";

// in-flight de-duplication: many students clicking the same word trigger one synthesis
const inflight = new Map<string, Promise<{ file: string; cached: boolean }>>();

function audio(file: string, cached: boolean) {
  return new Response(fs.readFileSync(file), {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-TTS-Cache": cached ? "hit" : "miss",
    },
  });
}

/** GET /api/tts?t=<Turkish text>&v=f|m — native Turkish speech (Gemini TTS, tr-TR), cached. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = normalizeTtsText(url.searchParams.get("t") ?? "");
  const voice: Voice = url.searchParams.get("v") === "m" ? "m" : "f";
  if (!isSpeakableTurkish(text)) return Response.json({ error: "Тек түрікше мәтін (500 таңбаға дейін)." }, { status: 400 });

  const hit = cachedPath(text, voice);
  if (hit) return audio(hit, true);

  const user = await currentUser();
  const g = guard(user, "tts");
  if (!g.ok) return Response.json({ error: g.message, code: g.code }, { status: g.status });

  const key = `${voice}|${text}`;
  try {
    let p = inflight.get(key);
    if (!p) {
      p = synthesize(text, voice, g.ttsModel, user).finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    const r = await p;
    return audio(r.file, r.cached);
  } catch (err) {
    logUsage(user, "tts", g.ttsModel, null, err);
    return Response.json({ error: friendlyAiError(err), code: "tts_failed" }, { status: 502 });
  }
}
