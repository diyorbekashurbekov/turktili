import "server-only";
import crypto from "node:crypto";
import { readFile, saveFile, type StoredFile } from "./storage";
import { ApiError } from "@google/genai";
import { gemini, logUsage } from "./ai";
import { TTS_CHAIN } from "./settings";
import type { User } from "./auth";

/**
 * Turkish speech synthesis with Gemini TTS (tr-TR), cached on disk.
 * Why server-side: browsers often have no Turkish voice and silently read Turkish
 * with an English voice. Gemini's native Turkish voice gives consistent pronunciation
 * on every device. Each unique text is synthesized once, then served from the cache
 * (local disk, or Vercel Blob in production — see storage.ts).
 */

export type Voice = "f" | "m";
export const VOICE_NAMES: Record<Voice, string> = {
  f: process.env.GEMINI_TTS_VOICE_F || "Kore", // clear, calm female voice
  m: process.env.GEMINI_TTS_VOICE_M || "Charon", // informative male voice (second dialogue speaker)
};
const CACHE_VERSION = "v2";

export function normalizeTtsText(t: string) {
  return t.replace(/\s+/g, " ").replace(/\s*\([^)]*\)/g, "").trim();
}

export function cacheKey(text: string, voice: Voice) {
  return crypto.createHash("sha256").update(`${CACHE_VERSION}|${voice}|${normalizeTtsText(text)}`).digest("hex").slice(0, 40);
}

const storageKey = (text: string, voice: Voice) => `tts/${cacheKey(text, voice)}.wav`;

export function readCached(text: string, voice: Voice): Promise<StoredFile | null> {
  return readFile(storageKey(normalizeTtsText(text), voice));
}

/** Turkish text only: Latin letters incl. Turkish ones; rejects Cyrillic so Kazakh is never read by a Turkish voice. */
export function isSpeakableTurkish(t: string) {
  return t.length > 0 && t.length <= 500 && /[a-zçğıöşüâîû]/i.test(t) && !/[Ѐ-ӿ]/.test(t);
}

function wavFromPcm(pcm: Buffer, rate: number) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Extracts 16-bit mono PCM from a WAV container. */
function pcmFromWav(buf: Buffer) {
  let rate = 24000;
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") rate = buf.readUInt32LE(off + 12);
    if (id === "data") return { pcm: buf.subarray(off + 8, Math.min(buf.length, off + 8 + size)), rate };
    off += 8 + size + (size % 2);
  }
  return { pcm: buf.subarray(44), rate };
}

/** Removes leading/trailing silence so single words play instantly; keeps ~120 ms padding. */
export function trimSilence(pcm: Buffer, rate: number) {
  const n = Math.floor(pcm.length / 2);
  const threshold = 600;
  let start = 0;
  let end = n - 1;
  while (start < n && Math.abs(pcm.readInt16LE(start * 2)) < threshold) start++;
  while (end > start && Math.abs(pcm.readInt16LE(end * 2)) < threshold) end--;
  if (start >= end) return pcm;
  const pad = Math.floor(rate * 0.12);
  return pcm.subarray(Math.max(0, start - pad) * 2, Math.min(n, end + pad) * 2);
}

export async function synthesize(text: string, voice: Voice, model: string, user: User | null): Promise<{ file: StoredFile; cached: boolean }> {
  const clean = normalizeTtsText(text);
  const hit = await readCached(clean, voice);
  if (hit) return { file: hit, cached: true };
  // Only the text itself: TTS models read any instruction text aloud.
  const { res, model: used } = await queued(() => synthWithChain(clean, voice, model));
  await logUsage(user, "tts", used, res.usageMetadata ?? null);
  const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error("TTS returned no audio");
  const raw = Buffer.from(part.inlineData.data, "base64");
  const mime = part.inlineData.mimeType ?? "";
  // some TTS models return a WAV container, others raw L16 PCM
  const { pcm, rate } = mime.includes("wav") || raw.toString("ascii", 0, 4) === "RIFF" ? pcmFromWav(raw) : { pcm: raw, rate: Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000) };
  const wav = wavFromPcm(trimSilence(pcm, rate), rate);
  try {
    await saveFile(storageKey(clean, voice), wav, "audio/wav");
  } catch (err) {
    // e.g. Vercel without Blob storage: still play the audio, just without caching it
    console.error("TTS cache write failed", err);
  }
  return { file: { body: wav, size: wav.length }, cached: false };
}

// ── free-tier friendly synthesis: one request at a time, model chain, honour retry delays ──
let queue: Promise<unknown> = Promise.resolve();
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

function retryDelayMs(err: unknown) {
  const m = err instanceof Error ? /"retryDelay":s*"(d+(?:.d+)?)s"/.exec(err.message) : null;
  return m ? Math.ceil(Number(m[1]) * 1000) : 0;
}

async function synthWithChain(text: string, voice: Voice, preferred: string) {
  const chain = [preferred, ...TTS_CHAIN.filter((m) => m !== preferred)];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    let shortestWait = Infinity;
    for (const model of chain) {
      try {
        const res = await gemini().models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: { languageCode: "tr-TR", voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAMES[voice] } } },
          },
        });
        return { res, model };
      } catch (err) {
        lastErr = err;
        if (!(err instanceof ApiError) || ![429, 500, 503, 404, 400].includes(err.status)) throw err;
        const wait = retryDelayMs(err);
        if (wait) shortestWait = Math.min(shortestWait, wait);
      }
    }
    // every model is rate-limited: wait once for Google's suggested delay (capped), then retry
    if (attempt === 0 && Number.isFinite(shortestWait) && shortestWait <= 25_000) await new Promise((r) => setTimeout(r, shortestWait + 300));
    else break;
  }
  throw lastErr;
}
