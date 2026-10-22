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
  /** the browser refused to start playback without a tap (mobile autoplay policy) */
  onBlocked?: () => void;
};

// One shared <audio> element for all speech. Phones (iOS Safari, Android Chrome) only allow
// audio that starts inside a tap; a reply that arrives seconds later is blocked if it uses a
// new element. An element that has played once inside a tap may play again later, so every
// speaking control calls unlockAudio() in its click handler and speak() reuses that element.
let player: HTMLAudioElement | null = null;
let unlocked = false;
let token = 0;

function getPlayer() {
  if (!player) {
    player = new Audio();
    player.preload = "auto";
    player.setAttribute("playsinline", "");
  }
  return player;
}

/** 50 ms of silence as a WAV blob URL (used to unlock the shared player). */
let silentUrl: string | null = null;
function silence() {
  if (silentUrl) return silentUrl;
  const rate = 8000;
  const n = rate / 20;
  const b = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o: number, s: string) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  b.setUint32(4, 36 + n * 2, true);
  w(8, "WAVEfmt ");
  b.setUint32(16, 16, true);
  b.setUint16(20, 1, true);
  b.setUint16(22, 1, true);
  b.setUint32(24, rate, true);
  b.setUint32(28, rate * 2, true);
  b.setUint16(32, 2, true);
  b.setUint16(34, 16, true);
  w(36, "data");
  b.setUint32(40, n * 2, true);
  silentUrl = URL.createObjectURL(new Blob([b.buffer], { type: "audio/wav" }));
  return silentUrl;
}

/** Call synchronously inside a tap/click handler before any delayed speech. Safe to call often. */
export function unlockAudio() {
  if (typeof window === "undefined" || unlocked) return;
  const p = getPlayer();
  try {
    p.src = silence();
    p.play()
      .then(() => {
        unlocked = true;
      })
      .catch(() => undefined);
  } catch {
    /* ignore */
  }
  // the browser's own speech engine needs the same gesture on iOS
  if ("speechSynthesis" in window) window.speechSynthesis.resume();
}

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
  const audio = getPlayer();
  const rate = opts.rate ?? 1;
  audio.src = ttsUrl(text, voice);
  audio.playbackRate = rate;
  (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  audio.onplaying = () => {
    if (my !== token) return;
    audio.playbackRate = rate; // some browsers reset the rate when the source changes
    opts.onStart?.();
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
  audio.play().catch((err: DOMException) => {
    if (my !== token || err?.name !== "NotAllowedError") return; // load errors are handled by onerror
    // blocked by the autoplay policy: let the UI offer a "tap to listen" button
    if (opts.onBlocked) return opts.onBlocked();
    notify("Телефон дыбысты өздігінен қоспады. Тыңдау үшін 🔊 белгісін басыңыз.");
    opts.onEnd?.();
  });
  return true;
}

export function stopSpeaking() {
  token++;
  if (player) {
    player.onended = player.onerror = player.onplaying = null;
    player.pause();
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
