import { z } from "zod";
import { currentUser, type User } from "@/lib/auth";
import { friendlyAiError, generate, guard, logUsage, speakingSystem, type SpeakingMode } from "@/lib/ai";
import { q } from "@/lib/db";
import { BRIEF, splitSpeech, toContents, type Turn } from "@/lib/speaking";
import { synthesize } from "@/lib/tts";

export const runtime = "nodejs";

const Meta = z.object({
  topic: z.string().max(80),
  questions: z.array(z.string().max(200)).max(10).default([]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(1500) })).max(40),
  mode: z.enum(["ogretmen", "sohbet"]).default("ogretmen"),
  finish: z.boolean().default(false),
  sessionId: z.number().int().nullable().optional(),
  examMode: z.boolean().default(false),
});

const TURN_SCHEMA = {
  type: "object",
  properties: {
    transcript: { type: "string", description: "Verbatim transcript of the student's audio (Turkish, Latin script). Empty if no speech." },
    reply: { type: "string", description: "Your spoken reply following the role rules." },
  },
  required: ["transcript", "reply"],
};

const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    summary_kz: { type: "string" },
    corrections: {
      type: "array",
      items: {
        type: "object",
        properties: { said: { type: "string" }, better: { type: "string" }, explanation_kz: { type: "string" } },
        required: ["said", "better", "explanation_kz"],
      },
    },
    strengths_kz: { type: "array", items: { type: "string" } },
    next_steps_kz: { type: "array", items: { type: "string" } },
    rubric: {
      type: "object",
      properties: {
        task: { type: "integer", minimum: 0, maximum: 4 },
        grammar: { type: "integer", minimum: 0, maximum: 4 },
        vocabulary: { type: "integer", minimum: 0, maximum: 4 },
        interaction: { type: "integer", minimum: 0, maximum: 4 },
      },
      required: ["task", "grammar", "vocabulary", "interaction"],
    },
    pronunciation_note_kz: {
      type: "string",
      description: "Pronunciation was NOT acoustically scored. Only mention words the transcript suggests were hard to recognize, and say that a teacher should check pronunciation.",
    },
  },
  required: ["summary_kz", "corrections", "strengths_kz", "next_steps_kz", "rubric", "pronunciation_note_kz"],
};

function saveSession(user: User, topic: string, transcript: Turn[], sessionId: number | null | undefined) {
  if (sessionId) {
    q.run("UPDATE speaking_sessions SET transcript = ? WHERE id = ? AND user_id = ?", JSON.stringify(transcript), sessionId, user.id);
    return sessionId;
  }
  return Number(q.run("INSERT INTO speaking_sessions (user_id, topic, transcript) VALUES (?,?,?)", user.id, topic, JSON.stringify(transcript)).lastInsertRowid);
}

/** Pre-synthesizes the Turkish part so the browser's /api/tts request is served from cache. */
async function voiceFor(reply: string, ttsModel: string, user: User) {
  const { turkish, kazakh } = splitSpeech(reply);
  if (turkish) {
    // wait at most 8 s so the text reply is never held up by a slow or rate-limited TTS;
    // synthesis keeps running and the client's /api/tts request picks up the result
    const job = synthesize(turkish, "f", ttsModel, user).catch(() => undefined);
    await Promise.race([job, new Promise((r) => setTimeout(r, 8000))]);
  }
  return { speakText: turkish, explanation: kazakh };
}

/**
 * Speaking partner. Accepts JSON (text turns) or multipart (a recorded audio turn).
 * An audio turn is transcribed and answered in ONE Gemini call, then voiced with Gemini TTS.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  const isMultipart = req.headers.get("content-type")?.startsWith("multipart/form-data");
  let raw: unknown;
  let audio: Blob | null = null;
  if (isMultipart) {
    const form = await req.formData();
    raw = JSON.parse(String(form.get("meta") ?? "{}"));
    const a = form.get("audio");
    audio = a instanceof Blob ? a : null;
    if (!audio || audio.size < 500 || audio.size > 6 * 1024 * 1024) return Response.json({ error: "Аудио жоқ немесе тым үлкен." }, { status: 400 });
  } else raw = await req.json().catch(() => null);
  const parsed = Meta.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Сұрау пішімі қате." }, { status: 400 });
  const { topic, questions, messages, finish, examMode, mode } = parsed.data;
  const { sessionId } = parsed.data;

  const g = guard(user, finish ? "speak-feedback" : "speak");
  if (!g.ok) return Response.json({ error: g.message, code: g.code }, { status: g.status });

  try {
    if (finish) {
      const { res, model } = await generate(g.textModel, {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${BRIEF(topic, questions)}\nMode: ${examMode ? "oral exam" : mode === "sohbet" ? "free conversation (mistakes were intentionally NOT corrected during the talk — now give the full constructive feedback)" : "teacher practice"}.\n\nTRANSCRIPT:\n${messages
                  .map((m) => `${m.role === "user" ? "STUDENT" : "PARTNER"}: ${m.content}`)
                  .join("\n")}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            "You give feedback on an A1 Turkish speaking practice transcript (speech-to-text output of a Kazakh student). Feedback text in Kazakh Cyrillic; corrected sentences in Turkish. Judge only against A1 expectations. Practice rubric 0–4 (not an official score). Do not claim any acoustic pronunciation assessment.",
          responseMimeType: "application/json",
          responseJsonSchema: FEEDBACK_SCHEMA,
        },
      });
      logUsage(user, "speak-feedback", model, res.usageMetadata ?? null);
      const feedback = JSON.parse(res.text ?? "null");
      if (sessionId) q.run("UPDATE speaking_sessions SET feedback = ?, transcript = ? WHERE id = ? AND user_id = ?", JSON.stringify(feedback), JSON.stringify(messages), sessionId, user.id);
      return Response.json({ feedback, sessionId });
    }

    const system = `${speakingSystem(mode, examMode)}\n\n${BRIEF(topic, questions)}`;
    let transcript = "";
    let reply = "";
    let usedModel = g.textModel;

    if (audio) {
      const contents = toContents(messages);
      contents.push({
        role: "user",
        parts: [
          { inlineData: { mimeType: (audio.type || "audio/webm").split(";")[0], data: Buffer.from(await audio.arrayBuffer()).toString("base64") } },
          { text: "This is the student's spoken answer. First transcribe it verbatim (keep their mistakes), then reply following your role." },
        ],
      });
      const { res, model } = await generate(g.textModel, {
        contents,
        config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: TURN_SCHEMA },
      }, "fast");
      usedModel = model;
      logUsage(user, "speak", model, res.usageMetadata ?? null);
      const out = JSON.parse(res.text ?? "{}") as { transcript?: string; reply?: string };
      transcript = (out.transcript ?? "").trim();
      reply = (out.reply ?? "").trim();
      if (!transcript) return Response.json({ transcript: "", reply: "", empty: true, sessionId: sessionId ?? null });
    } else {
      const { res, model } = await generate(g.textModel, { contents: toContents(messages), config: { systemInstruction: system } }, "fast");
      usedModel = model;
      logUsage(user, "speak", model, res.usageMetadata ?? null);
      reply = (res.text ?? "").trim();
    }
    void usedModel;

    const history: Turn[] = transcript ? [...messages, { role: "user", content: transcript }, { role: "assistant", content: reply }] : [...messages, { role: "assistant", content: reply }];
    const id = saveSession(user, topic, history, sessionId);
    const voice = await voiceFor(reply, g.ttsModel, user);
    return Response.json({ transcript, reply, ...voice, sessionId: id });
  } catch (err) {
    logUsage(user, finish ? "speak-feedback" : "speak", g.textModel, null, err);
    return Response.json({ error: friendlyAiError(err) }, { status: 502 });
  }
}
