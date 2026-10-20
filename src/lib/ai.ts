import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel, type Content, type GenerateContentResponse } from "@google/genai";
import { q, logError } from "./db";
import { FALLBACK, getSettings, PRICING } from "./settings";
import { isGuest, rateLimit, type User } from "./auth";

/** True when the server holds a Gemini API key. The key never leaves the server. */
export function aiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

let client: GoogleGenAI | null = null;
export function gemini() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export type GuardResult = { ok: true; textModel: string; ttsModel: string } | { ok: false; status: number; code: string; message: string };

export function todaySpendUsd() {
  return q.get<{ s: number | null }>("SELECT SUM(cost_usd) AS s FROM ai_usage WHERE created_at >= date('now')")?.s ?? 0;
}

export function userRequestsToday(userId: string, kind: "ai" | "tts" = "ai") {
  const sql =
    kind === "tts"
      ? "SELECT COUNT(*) AS c FROM ai_usage WHERE user_id = ? AND route = 'tts' AND created_at >= date('now')"
      : "SELECT COUNT(*) AS c FROM ai_usage WHERE user_id = ? AND route <> 'tts' AND created_at >= date('now')";
  return q.get<{ c: number }>(sql, userId)?.c ?? 0;
}

/** Cost protection: kill switch, global daily budget, per-user quota, burst rate limit. */
export function guard(user: User, route: string): GuardResult {
  const s = getSettings();
  if (!aiConfigured())
    return { ok: false, status: 503, code: "not_configured", message: "AI мұғалім әлі қосылмаған: серверде GEMINI_API_KEY орнатылмаған." };
  if (!s.aiEnabled) return { ok: false, status: 503, code: "disabled", message: "AI мұғалімді әкімші уақытша өшірді." };
  if (todaySpendUsd() >= s.dailyBudgetUsd)
    return { ok: false, status: 429, code: "budget", message: "Бүгінгі ортақ AI лимиті таусылды. Ертең қайта көріңіз — басқа жаттығулар жұмыс істейді." };
  if (route === "tts") {
    if (userRequestsToday(user.id, "tts") >= s.ttsDailyPerUser)
      return { ok: false, status: 429, code: "quota", message: "Бүгінгі дыбыс лимиті бітті. Ертең жалғастырыңыз." };
    if (!rateLimit(`tts:${user.id}`, 40, 60_000)) return { ok: false, status: 429, code: "rate", message: "Тым жиі сұрау. Сәлден соң қайталаңыз." };
    return { ok: true, textModel: s.textModel, ttsModel: s.ttsModel };
  }
  const limit = isGuest(user) ? s.guestDailyRequests : s.memberDailyRequests;
  if (userRequestsToday(user.id) >= limit)
    return {
      ok: false,
      status: 429,
      code: "quota",
      message: isGuest(user)
        ? `Қонақ режимінде күніне ${limit} AI сұрау бар. Тіркелсеңіз, лимит ұлғаяды.`
        : `Бүгінгі ${limit} AI сұрау лимитіңіз бітті. Ертең жалғастырыңыз.`,
    };
  if (!rateLimit(`ai:${user.id}`, 12, 60_000)) return { ok: false, status: 429, code: "rate", message: "Тым жиі сұрау. Бір минуттан соң қайталаңыз." };
  return { ok: true, textModel: s.textModel, ttsModel: s.ttsModel };
}

type Usage = GenerateContentResponse["usageMetadata"];

export function logUsage(user: User | null, route: string, model: string, usage: Usage | null, error?: unknown) {
  const p = PRICING[model] ?? { in: 0.5, out: 10 };
  const input = usage?.promptTokenCount ?? 0;
  const out = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  const cacheRead = usage?.cachedContentTokenCount ?? 0;
  const cost = (input * p.in + out * p.out) / 1_000_000;
  q.run(
    "INSERT INTO ai_usage (user_id, route, model, input_tokens, output_tokens, cache_read_tokens, cost_usd, ok, error) VALUES (?,?,?,?,?,?,?,?,?)",
    user?.id ?? null,
    route,
    model,
    input,
    out,
    cacheRead,
    cost,
    error ? 0 : 1,
    error ? String(error instanceof Error ? error.message : error).slice(0, 500) : null,
  );
  if (error) logError(`ai:${route}`, error);
}

/** Retryable on the fallback model: overloaded, rate-limited, unavailable or unknown model. */
function shouldFallback(err: unknown) {
  return err instanceof ApiError && [404, 429, 500, 503].includes(err.status);
}

export type Effort = "fast" | "normal" | "none";

/**
 * Reasoning settings differ by model family: Gemini 2.5 uses thinkingBudget, Gemini 3.x uses
 * thinkingLevel, lite and TTS models take neither. Mapping per model keeps fallbacks valid.
 */
export function thinkingFor(model: string, effort: Effort) {
  if (effort === "none" || /tts|lite/.test(model)) return {};
  if (model.startsWith("gemini-2.5")) return { thinkingConfig: { thinkingBudget: effort === "fast" ? 0 : model.includes("pro") ? 1024 : 768 } };
  return { thinkingConfig: { thinkingLevel: effort === "fast" ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW } };
}

type Params = { contents: Content[] | string; config?: Record<string, unknown> };
const withEffort = (model: string, p: Params, effort: Effort): Params => ({ ...p, config: { ...(p.config ?? {}), ...thinkingFor(model, effort) } });

/** generateContent with automatic fallback to the sibling model when Google reports overload. */
export async function generate(model: string, params: Params, effort: Effort = "normal") {
  try {
    return { res: await gemini().models.generateContent({ model, ...withEffort(model, params, effort) }), model };
  } catch (err) {
    const fb = FALLBACK[model];
    if (!fb || !shouldFallback(err)) throw err;
    return { res: await gemini().models.generateContent({ model: fb, ...withEffort(fb, params, effort) }), model: fb };
  }
}

export async function generateStream(model: string, params: Params, effort: Effort = "normal") {
  try {
    return { stream: await gemini().models.generateContentStream({ model, ...withEffort(model, params, effort) }), model };
  } catch (err) {
    const fb = FALLBACK[model];
    if (!fb || !shouldFallback(err)) throw err;
    return { stream: await gemini().models.generateContentStream({ model: fb, ...withEffort(fb, params, effort) }), model: fb };
  }
}

/** Maps SDK errors to messages a student understands. */
export function friendlyAiError(err: unknown) {
  if (err instanceof ApiError) {
    if (err.status === 400) return "AI сұрауы қабылданбады. Мәтінді қысқартып көріңіз.";
    if (err.status === 401 || err.status === 403) return "AI кілті жарамсыз немесе рұқсат жоқ. Әкімшіге хабарлаңыз.";
    if (err.status === 429) return "AI қызметінің лимиті толды. Сәлден соң қайталаңыз.";
    if (err.status >= 500) return "AI қызметі қазір бос емес. Сәлден соң қайталаңыз.";
    return `AI қызметінің қатесі (${err.status}).`;
  }
  if (err instanceof Error && /fetch failed|ENOTFOUND|ECONN/i.test(err.message)) return "AI қызметіне қосылу мүмкін болмады.";
  return "Күтпеген қате болды.";
}

export const TEACHER_SYSTEM = `You are "Yedi İklim Öğretmeni", a patient, warm and precise Turkish teacher inside the Yedi İklim Türkçe A1 learning platform (Yunus Emre Enstitüsü textbook, 192 pages, 8 units).

Students: first-year university students in Kazakhstan preparing for an A1 Turkish exam (okuma, dinleme, yazma, konuşma) in 2–3 weeks. Their first language is Kazakh (Cyrillic). Many also know Russian.

Language policy:
- Explain in clear, short Kazakh. Give Turkish examples in Turkish. Keep Turkish at CEFR A1 level.
- If the student writes in Turkish, you may answer mostly in simple Turkish with key points repeated in Kazakh.
- Never use grammar far beyond A1 when correcting; do not penalize a student for not using it.

Grounding policy (very important):
- Each request may include a PAGE CONTEXT block: a verified analysis of the textbook page the student has open (summary, vocabulary with Kazakh glosses, grammar notes, suggested answers with a confidence label). Treat it as your source of truth about the textbook.
- Only state what the textbook contains when the PAGE CONTEXT supports it, and cite it as "(кітап, N-бет)". If the information is missing or uncertain, say so plainly ("бұл беттің талдауында жоқ") — never invent textbook content, page numbers, dialogues or answers.
- Answers labelled "audio-unverified" or "uncertain" are NOT verified; say that they are suggested answers when you use them.
- When you create your own examples or exercises, mark them clearly with "Мысал (платформа):" so students can tell them apart from the book.

Teaching style:
- Short paragraphs, small steps. Prefer one idea at a time, then a quick check question.
- When a student makes a mistake: show the wrong form, the correct form, a one-line reason in Kazakh, and one more example.
- Use simple Markdown (bold, short lists, small tables). No headings larger than ###.
- Be encouraging but honest. No exaggerated praise.`;

export type SpeakingMode = "ogretmen" | "sohbet";

/** System prompts for the two speaking modes. Replies are spoken by TTS: plain text only. */
export function speakingSystem(mode: SpeakingMode, examMode = false) {
  const common = `You speak with a Kazakh university student who is learning Turkish at CEFR A1 with the Yedi İklim A1 textbook.
Your replies are converted to speech by a Turkish text-to-speech voice, so write plain text only: no Markdown, emojis, lists, brackets or stage directions.
Use simple A1 Turkish: short sentences (about 12 words max), common words of the topic, present tense, -DI past and -AcAk future.
Ask only one question per turn. Stay on the topic.
The student's words come from speech recognition and may contain small recognition errors; do not over-correct spelling.`;
  if (examMode)
    return `${common}
ROLE: a calm oral examiner for an A1 practice exam. Ask the suggested questions one by one. Do not correct or teach during the exam; give a short neutral acknowledgement ("Teşekkürler.", "Anladım.") and ask the next question.`;
  if (mode === "ogretmen")
    return `${common}
ROLE: ÖĞRETMEN — a professional, kind Turkish teacher.
- Ask A1 questions about the topic.
- After each answer: if there is an error, model the correct sentence once ("Doğrusu: ...").
- Then, if the error is about grammar or a word, add ONE short explanation sentence in Kazakh that starts with "Түсіндірме:" (Kazakh Cyrillic). Keep Turkish and Kazakh in separate sentences.
- If the answer is correct, praise briefly in Turkish ("Çok güzel!") and ask the next question.
- If the student says they do not understand, rephrase more simply and give the Kazakh meaning after "Түсіндірме:".`;
  return `${common}
ROLE: SOHBET — a friendly native Turkish speaker having a natural, relaxed conversation (like meeting a new friend at a café in Istanbul).
- Keep the conversation flowing: react naturally ("Ne güzel!", "Gerçekten mi?"), share a short detail about yourself, then ask a follow-up question.
- Do NOT correct mistakes during the conversation, and never switch to Kazakh. Only if a mistake makes the meaning unclear, gently ask again or naturally recast it in your reply.
- Never mention that you are an AI unless asked.`;
}
