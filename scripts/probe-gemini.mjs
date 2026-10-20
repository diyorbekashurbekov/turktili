// Probes Gemini models for this project: text quality/latency, Turkish TTS, and a
// round-trip intelligibility check (TTS audio → transcription → compare with the source text).
// Usage: node --env-file=.env.local scripts/probe-gemini.mjs
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const out = path.resolve(import.meta.dirname, "../data/probe");
fs.mkdirSync(out, { recursive: true });

const TEXT_MODELS = (process.argv.find((a) => a.startsWith("--text="))?.slice(7) ?? "gemini-3.5-flash,gemini-2.5-flash").split(",");
const TTS_MODELS = (process.argv.find((a) => a.startsWith("--tts="))?.slice(6) ?? "gemini-3.8-flash-tts,gemini-2.5-flash-preview-tts").split(",");
const STT_MODEL = process.argv.find((a) => a.startsWith("--stt="))?.slice(6) ?? "gemini-3.5-flash";
const SENTENCES = ["Merhaba, benim adım Elif. Ben öğretmenim.", "Kahvaltıdan sonra okula gidiyorum.", "ağabey", "Günaydın! Nasılsınız?"];

export function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const norm = (s) => s.toLocaleLowerCase("tr").replace(/[.,!?;:"']/g, "").replace(/\s+/g, " ").trim();

for (const model of TEXT_MODELS) {
  const t = Date.now();
  try {
    const r = await ai.models.generateContent({
      model,
      contents: "Түрікшедегі «-DA» жатыс жалғауын қазақша 2 сөйлеммен түсіндір де, бір түрікше мысал бер.",
      config: { systemInstruction: "Сен A1 деңгейіндегі түрік тілі мұғалімісің. Қысқа жауап бер." },
    });
    console.log(`TEXT ${model} ${Date.now() - t}ms tokens in/out ${r.usageMetadata?.promptTokenCount}/${r.usageMetadata?.candidatesTokenCount}\n  ${r.text?.replace(/\n/g, " ").slice(0, 220)}`);
  } catch (e) {
    console.log(`TEXT ${model} FAILED: ${e.message?.slice(0, 200)}`);
  }
}

for (const model of TTS_MODELS) {
  for (const [i, s] of SENTENCES.entries()) {
    const t = Date.now();
    try {
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: `Türkçe olarak, yerli bir Türk öğretmen gibi açık ve doğal söyle: ${s}` }] }],
        config: { responseModalities: ["AUDIO"], speechConfig: { languageCode: "tr-TR", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
      });
      const part = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      const pcm = Buffer.from(part.inlineData.data, "base64");
      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? "")?.[1] ?? 24000);
      const file = path.join(out, `${model}-${i}.wav`);
      fs.writeFileSync(file, wav(pcm, rate));
      const ms = Date.now() - t;
      // round trip: transcribe the produced audio and compare
      const tr = await ai.models.generateContent({
        model: STT_MODEL,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: fs.readFileSync(file).toString("base64") } }, { text: "Bu Türkçe ses kaydını kelimesi kelimesine yaz. Sadece metni yaz." }] }],
      });
      const heard = tr.text?.trim() ?? "";
      console.log(`TTS ${model} #${i} ${ms}ms ${(pcm.length / (rate * 2)).toFixed(1)}s ${part.inlineData.mimeType} | heard: "${heard}" | match=${norm(heard) === norm(s)}`);
    } catch (e) {
      console.log(`TTS ${model} #${i} FAILED: ${e.message?.slice(0, 200)}`);
    }
  }
}
