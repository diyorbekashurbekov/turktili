import "server-only";
import { q } from "./db";

export type ExamConfig = {
  readingQuestions: number;
  listeningQuestions: number;
  grammarQuestions: number;
  vocabQuestions: number;
  writingTasks: number;
  speakingQuestions: number;
  minutes: { okuma: number; dinleme: number; yazma: number; konusma: number; full: number };
};

export type Settings = {
  aiEnabled: boolean;
  textModel: string;
  ttsModel: string;
  ttsDailyPerUser: number;
  dailyBudgetUsd: number;
  guestDailyRequests: number;
  memberDailyRequests: number;
  pageImagesAuthorized: boolean;
  exam: ExamConfig;
};

export const DEFAULT_SETTINGS: Settings = {
  aiEnabled: true,
  textModel: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
  ttsModel: process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts",
  ttsDailyPerUser: 400,
  dailyBudgetUsd: Number(process.env.AI_DAILY_BUDGET_USD || 5),
  guestDailyRequests: 15,
  memberDailyRequests: 60,
  pageImagesAuthorized: process.env.BOOK_PAGES_AUTHORIZED === "true",
  exam: {
    readingQuestions: 10,
    listeningQuestions: 8,
    grammarQuestions: 10,
    vocabQuestions: 15,
    writingTasks: 1,
    speakingQuestions: 5,
    minutes: { okuma: 20, dinleme: 20, yazma: 25, konusma: 12, full: 75 },
  },
};

export function getSettings(): Settings {
  const rows = q.all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const s: Settings = structuredClone(DEFAULT_SETTINGS);
  for (const r of rows) {
    try {
      (s as Record<string, unknown>)[r.key] = JSON.parse(r.value);
    } catch {
      // ignore malformed values
    }
  }
  // values saved by older versions (e.g. a Claude model id) must never reach the Gemini client
  if (!TEXT_MODELS.includes(s.textModel)) s.textModel = DEFAULT_SETTINGS.textModel;
  if (!TTS_MODELS.includes(s.ttsModel)) s.ttsModel = DEFAULT_SETTINGS.ttsModel;
  s.exam = { ...DEFAULT_SETTINGS.exam, ...s.exam, minutes: { ...DEFAULT_SETTINGS.exam.minutes, ...(s.exam?.minutes ?? {}) } };
  return s;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  q.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    JSON.stringify(value),
  );
}

// Estimated USD per 1M tokens (input, output). Gemini prices change; verify in Google AI Studio billing.
// Audio output tokens of TTS models are billed at the higher output rate.
export const PRICING: Record<string, { in: number; out: number }> = {
  "gemini-3.5-flash": { in: 0.3, out: 2.5 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "gemini-3.5-flash-lite": { in: 0.1, out: 0.4 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "gemini-2.5-pro": { in: 1.25, out: 10 },
  "gemini-3.8-flash-tts": { in: 0.5, out: 10 },
  "gemini-3.8-flash-lite-tts": { in: 0.25, out: 5 },
  "gemini-3.1-flash-tts-preview": { in: 0.5, out: 10 },
};
export const TEXT_MODELS = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-pro"];
export const TTS_MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview"];
/** Tried in order when a TTS model is rate-limited or overloaded (free tier has low per-minute limits). */
export const TTS_CHAIN = TTS_MODELS;
/** Used automatically when the configured model is overloaded or unavailable. */
export const FALLBACK: Record<string, string> = {
  "gemini-3.5-flash": "gemini-2.5-flash",
  "gemini-2.5-flash": "gemini-3.5-flash-lite",
  "gemini-3.5-flash-lite": "gemini-2.5-flash",
  "gemini-2.5-pro": "gemini-2.5-flash",
};
