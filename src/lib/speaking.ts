import "server-only";
import type { Content } from "@google/genai";

export type Turn = { role: "user" | "assistant"; content: string };

export const OPENING = "(Öğrenci hazır. Konuşmayı sen başlat: selam ver ve ilk soruyu sor.)";

/** Gemini history: must start with a user turn, roles user/model. */
export function toContents(turns: Turn[]): Content[] {
  return [{ role: "user", parts: [{ text: OPENING }] }, ...turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] }))];
}

/** Splits a teacher reply into the Turkish part (spoken) and the Kazakh explanation (shown only). */
export function splitSpeech(reply: string) {
  const sentences = reply.replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+/);
  const turkish: string[] = [];
  const kazakh: string[] = [];
  for (const s of sentences) (/[Ѐ-ӿ]/.test(s) ? kazakh : turkish).push(s);
  return { turkish: turkish.join(" ").replace(/Түсіндірме:?/g, "").trim(), kazakh: kazakh.join(" ").trim() };
}

export const BRIEF = (topic: string, questions: string[]) =>
  `Topic: ${topic}. Suggested A1 questions from the platform's unit plan (use them as a guide, in your own order): ${questions.join(" | ") || "—"}.`;
