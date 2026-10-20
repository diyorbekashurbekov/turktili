import { currentUser } from "@/lib/auth";
import { friendlyAiError, generate, guard, logUsage } from "@/lib/ai";

export const runtime = "nodejs";
// Gemini calls (and retry waits when rate-limited) can take tens of seconds
export const maxDuration = 60;

const MAX_BYTES = 6 * 1024 * 1024;

/** Speech-to-text for the chat microphone: Gemini audio understanding (tr-TR or kk-KZ). */
export async function POST(req: Request) {
  const user = await currentUser();
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const lang = form?.get("lang") === "kk-KZ" ? "kk-KZ" : "tr-TR";
  if (!(audio instanceof Blob) || audio.size < 500 || audio.size > MAX_BYTES) return Response.json({ error: "Аудио жоқ немесе тым үлкен." }, { status: 400 });

  const g = await guard(user, "transcribe");
  if (!g.ok) return Response.json({ error: g.message, code: g.code }, { status: g.status });
  try {
    const { res, model } = await generate(g.textModel, {
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                lang === "tr-TR"
                  ? "You are a speech-to-text engine. Write down exactly the words spoken in the following audio, in Turkish (Latin script with ç ğ ı İ ö ş ü). The clip may be a single word or a short phrase — do not expand, complete or paraphrase it. The speaker is a learner: keep their actual words, including mistakes. Output only the spoken words, nothing else. If there is no speech, output nothing."
                  : "You are a speech-to-text engine. Write down exactly the words spoken in the following audio. The speaker may use Kazakh (write it in Kazakh Cyrillic) and Turkish words (write them in Turkish Latin script). The clip may be a single word — do not expand or paraphrase it. Output only the spoken words. If there is no speech, output nothing.",
            },
            { inlineData: { mimeType: (audio.type || "audio/webm").split(";")[0], data: Buffer.from(await audio.arrayBuffer()).toString("base64") } },
          ],
        },
      ],
      config: {},
    }, "fast");
    await logUsage(user, "transcribe", model, res.usageMetadata ?? null);
    return Response.json({ text: (res.text ?? "").trim() });
  } catch (err) {
    await logUsage(user, "transcribe", g.textModel, null, err);
    return Response.json({ error: friendlyAiError(err) }, { status: 502 });
  }
}
