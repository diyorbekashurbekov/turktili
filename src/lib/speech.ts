"use client";
// Turkish speech for the platform.
//
// Output (TTS)
//  1) Primary: native Turkish voice synthesized on the server (Gemini TTS, tr-TR) and cached.
//  2) Fallback: the browser's own voice ONLY if it is a real Turkish (tr-*) voice.
//  Never: Turkish read by a non-Turkish voice. That was the cause of the unnatural
//  pronunciation — browsers without a Turkish voice silently used their default English voice.
//
// Input (STT)
//  Microphone audio is recorded with MediaRecorder (works on Android Chrome, iOS Safari,
//  desktop browsers incl. Firefox) and transcribed on the server by Gemini — so recognition
//  no longer depends on the browser having a Turkish speech recognizer.

import { useCallback, useEffect, useRef, useState } from "react";

export function ttsSupported() {
  return typeof window !== "undefined" && "Audio" in window;
}

let voicesCache: SpeechSynthesisVoice[] = [];
function loadVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  voicesCache = window.speechSynthesis.getVoices();
  return voicesCache;
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

/** Real Turkish voices installed in this browser (may be empty). */
export function turkishVoices() {
  const v = voicesCache.length ? voicesCache : loadVoices();
  return v.filter((x) => x.lang?.toLowerCase().startsWith("tr"));
}

export type SpeakOptions = {
  /** playback speed; 1 = natural, 0.7 = slow (pitch preserved) */
  rate?: number;
  /** f = female (default), m = male; a/b kept for dialogue speakers */
  voice?: "a" | "b" | "f" | "m";
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (msg: string) => void;
};

let current: HTMLAudioElement | null = null;
let token = 0;

const voiceOf = (v?: SpeakOptions["voice"]) => (v === "b" || v === "m" ? "m" : "f");

export function ttsUrl(text: string, voice: "f" | "m" = "f") {
  return `/api/tts?t=${encodeURIComponent(text.replace(/\s+/g, " ").trim())}&v=${voice}`;
}

function notify(msg: string) {
  window.dispatchEvent(new CustomEvent("yi-audio-error", { detail: msg }));
}

function browserTurkish(text: string, opts: SpeakOptions, my: number) {
  const tr = turkishVoices();
  if (!tr.length || !("speechSynthesis" in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = tr[0];
  u.lang = tr[0].lang;
  u.rate = opts.rate ?? 1;
  u.onend = u.onerror = () => {
    if (my === token) opts.onEnd?.();
  };
  window.speechSynthesis.speak(u);
  opts.onStart?.();
  return true;
}

/** Speaks Turkish text with a native Turkish voice (async). */
export function speak(text: string, opts: SpeakOptions = {}) {
  if (typeof window === "undefined") return false;
  stopSpeaking();
  const my = ++token;
  const voice = voiceOf(opts.voice);
  const audio = new Audio(ttsUrl(text, voice));
  audio.preload = "auto";
  audio.playbackRate = opts.rate ?? 1;
  (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  current = audio;
  audio.onplaying = () => {
    if (my === token) opts.onStart?.();
  };
  audio.onended = () => {
    if (my === token) opts.onEnd?.();
  };
  audio.onerror = async () => {
    if (my !== token) return;
    let msg = "Түрікше дыбыс жүктелмеді.";
    try {
      const r = await fetch(ttsUrl(text, voice));
      if (!r.ok) msg = ((await r.json()) as { error?: string }).error ?? msg;
    } catch {
      msg = "Желі қатесі: дыбыс жүктелмеді.";
    }
    if (my !== token) return;
    if (browserTurkish(text, opts, my)) return;
    notify(`${msg} Түрік дауысы қолжетімсіз болғандықтан, мәтін басқа тілдің дауысымен оқылмайды.`);
    opts.onError?.(msg);
    opts.onEnd?.();
  };
  audio.play().catch(() => {
    /* autoplay policy: onerror/onended still drive state */
  });
  return true;
}

export function stopSpeaking() {
  token++;
  if (current) {
    current.pause();
    current = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Speaks lines in sequence (dialogues). Resolves when finished or interrupted. */
export function speakSequence(lines: { text: string; voice?: SpeakOptions["voice"] }[], rate = 1, onLine?: (i: number) => void) {
  // warm the server cache for all lines so playback flows without gaps
  for (const l of lines) fetch(ttsUrl(l.text, voiceOf(l.voice))).catch(() => undefined);
  return new Promise<void>((resolve) => {
    let i = 0;
    let expected = -1;
    const next = () => {
      if (i >= lines.length || (expected !== -1 && token !== expected)) return resolve();
      onLine?.(i);
      const line = lines[i++];
      speak(line.text, { rate, voice: line.voice, onEnd: () => setTimeout(next, 300), onError: () => resolve() });
      expected = token;
    };
    next();
  });
}

// ───────────────────────────── microphone ─────────────────────────────

export type MicState = "idle" | "listening" | "processing" | "denied" | "unsupported" | "error";

export function sttSupported() {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

function pickMime() {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported?.(m)) return m;
  return "";
}

/**
 * Microphone hook. `start(onFinal)` records one utterance, stops automatically after a
 * short silence (or on `stop()`), sends it to the server for Gemini transcription and
 * calls `onFinal(text)`. `startRaw(onAudio)` returns the recording itself (voice turns).
 * `level` (0–1) drives the subtle audio visualization.
 */
export function useRecognizer(lang: "tr-TR" | "kk-KZ" = "tr-TR") {
  const [state, setState] = useState<MicState>("idle");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!sttSupported()) setState("unsupported");
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    setLevel(0);
  }

  const record = useCallback(async (onAudio: (blob: Blob, mime: string) => void, autoStop = true) => {
    if (!sttSupported()) return setState("unsupported");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        cleanup();
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size < 1500) {
          setState("idle");
          return;
        }
        onAudio(blob, type);
      };
      recRef.current = rec;
      rec.start(250);
      setState("listening");

      // level meter + voice activity detection (auto-stop after silence)
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.fftSize);
      const began = performance.now();
      let spoke = false;
      let lastLoud = began;
      const tick = () => {
        an.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 6));
        const now = performance.now();
        if (rms > 0.035) {
          spoke = true;
          lastLoud = now;
        }
        const silentFor = now - lastLoud;
        if (autoStop && rec.state === "recording" && ((spoke && silentFor > 1400) || now - began > 30000 || (!spoke && now - began > 9000))) {
          rec.stop();
          return;
        }
        if (rec.state === "recording") rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      cleanup();
      const name = (e as DOMException)?.name;
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      setError(name === "NotFoundError" ? "Микрофон табылмады." : null);
    }
  }, []);

  const start = useCallback(
    (onFinal: (text: string) => void) =>
      record(async (blob) => {
        setState("processing");
        try {
          const fd = new FormData();
          fd.append("audio", blob, "speech");
          fd.append("lang", lang);
          const res = await fetch("/api/ai/transcribe", { method: "POST", body: fd });
          const d = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) throw new Error(d.error || "Тану мүмкін болмады.");
          setState("idle");
          if (d.text?.trim()) onFinal(d.text.trim());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Қате");
          setState("error");
        }
      }),
    [lang, record],
  );

  const startRaw = useCallback((onAudio: (blob: Blob, mime: string) => void, autoStop = true) => record(onAudio, autoStop), [record]);

  const stop = useCallback(() => {
    if (recRef.current?.state === "recording") recRef.current.stop();
  }, []);

  return { state, setState, level, error, start, startRaw, stop, interim: "", supported: state !== "unsupported" };
}
