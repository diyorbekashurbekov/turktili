import { currentUser } from "@/lib/auth";
import { friendlyAiError, guard, logUsage } from "@/lib/ai";
import { isSpeakableTurkish, normalizeTtsText, readCached, synthesize, type Voice } from "@/lib/tts";
import type { StoredFile } from "@/lib/storage";

export const runtime = "nodejs";
// synthesis can wait for Gemini's retry delay (up to ~25 s) when rate-limited
export const maxDuration = 60;

// in-flight de-duplication: many students clicking the same word trigger one synthesis
const inflight = new Map<string, Promise<{ file: StoredFile; cached: boolean }>>();

function audio(file: StoredFile, cached: boolean) {
  const body = Buffer.isBuffer(file.body) ? new Uint8Array(file.body) : file.body;
  return new Response(body, {
    headers: {
      "Content-Type": "audio/wav",
      ...(file.size ? { "Content-Length": String(file.size) } : {}),
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

  const hit = await readCached(text, voice);
  if (hit) return audio(hit, true);

  const user = await currentUser();
  const g = await guard(user, "tts");
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
    await logUsage(user, "tts", g.ttsModel, null, err);
    return Response.json({ error: friendlyAiError(err), code: "tts_failed" }, { status: 502 });
  }
}
