"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, Eye, EyeOff, Check, X } from "lucide-react";
import type { DialogueLine } from "@/content/practice";
import { speak, speakSequence, stopSpeaking, ttsSupported } from "@/lib/speech";
import { foldTr, normTr, track } from "@/lib/client";

export function GeneratedAudioNote() {
  return <p className="text-xs text-ink-3">Дыбыс серверде Gemini TTS (tr-TR, түрік тілінің дауысы) арқылы жасалады. Бұл кітаптың түпнұсқа аудиосы емес.</p>;
}

// Dialogue speakers get a matching voice; if both speakers of a dialogue map to the same one, fall back to A/B.
const MALE = new Set(["Murat", "Selim", "Ahmet", "Satıcı", "Turist", "Doktor"]);
const FEMALE = new Set(["Deniz", "Elif", "Ayşe", "Kadın", "Müşteri", "Sunucu", "Sekreter", "Hasta"]);
export function voicedLines(lines: DialogueLine[]) {
  const gender = (l: DialogueLine) => (MALE.has(l.speaker) ? "m" : FEMALE.has(l.speaker) ? "f" : l.voice === "b" ? "m" : "f");
  const bySpeaker = new Map<string, "f" | "m">();
  for (const l of lines) if (!bySpeaker.has(l.speaker)) bySpeaker.set(l.speaker, gender(l));
  const distinct = new Set(bySpeaker.values()).size === bySpeaker.size || bySpeaker.size < 2;
  return lines.map((l) => ({ ...l, voice: distinct ? bySpeaker.get(l.speaker)! : l.voice === "b" ? ("m" as const) : ("f" as const) }));
}

export function DialoguePlayer({ lines: raw }: { lines: DialogueLine[] }) {
  const lines = voicedLines(raw);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [rate, setRate] = useState(0.9);
  const [showText, setShowText] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(ttsSupported());
    return () => stopSpeaking();
  }, []);

  const playAll = async () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      setCurrent(null);
      return;
    }
    setPlaying(true);
    await speakSequence(lines, rate, setCurrent);
    setPlaying(false);
    setCurrent(null);
  };

  if (!supported)
    return <div className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber">Бұл браузерде сөйлеу синтезі жоқ. Chrome, Edge немесе Safari қолданыңыз.</div>;

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-teal h-12 w-12 rounded-full p-0" onClick={playAll} aria-label={playing ? "Тоқтату" : "Тыңдау"}>
          {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="text-sm font-medium">Диалогты тыңдаңыз</div>
          <div className="text-xs text-ink-3">{lines.length} сөйлем · әр сөйлемді бөлек қайталауға болады</div>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-2">
          Жылдамдық
          <select className="rounded-full border hairline bg-bg px-2 py-1" value={rate} onChange={(e) => setRate(+e.target.value)}>
            <option value={0.7}>0.7×</option>
            <option value={0.85}>0.85×</option>
            <option value={0.9}>0.9×</option>
            <option value={1}>1×</option>
          </select>
        </label>
        <button className="btn btn-ghost h-9 px-3 text-xs" onClick={() => setShowText((v) => !v)}>
          {showText ? <EyeOff size={14} /> : <Eye size={14} />} {showText ? "Мәтінді жасыру" : "Мәтінді көрсету"}
        </button>
      </div>
      <ol className="mt-5 space-y-1">
        {lines.map((l, i) => (
          <li key={i} className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors ${current === i ? "bg-teal-soft" : ""}`}>
            <button className="icon-btn h-8 w-8 shrink-0" onClick={() => speak(l.text, { rate, voice: l.voice })} aria-label={`${i + 1}-сөйлемді қайталау`}>
              <RotateCcw size={14} />
            </button>
            <span className="w-20 shrink-0 text-xs font-semibold text-ink-3">{l.speaker}</span>
            <span className={`text-[0.95rem] transition-all ${showText ? "" : "select-none blur-[5px]"}`} aria-hidden={!showText}>
              {l.text}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4">
        <GeneratedAudioNote />
      </div>
    </div>
  );
}

export function Dictation({ sentences, unit }: { sentences: string[]; unit: number }) {
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<null | "exact" | "close" | "wrong">(null);
  const [score, setScore] = useState(0);
  const target = sentences[i];
  const finished = i >= sentences.length;

  const check = () => {
    const exact = normTr(value) === normTr(target);
    const close = !exact && foldTr(value) === foldTr(target);
    const r = exact ? "exact" : close ? "close" : "wrong";
    setResult(r);
    if (r !== "wrong") setScore((s) => s + 1);
    track({ type: "attempts", skill: "dikte", unit, items: [{ itemId: `u${unit}d${i}`, correct: r !== "wrong", given: value }] });
  };

  if (finished)
    return (
      <div className="card flex items-center justify-between p-5">
        <div>
          <div className="eyebrow">Диктант нәтижесі</div>
          <div className="mt-1 font-serif text-2xl">
            {score} / {sentences.length}
          </div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setI(0);
            setScore(0);
            setValue("");
            setResult(null);
          }}
        >
          Қайта бастау
        </button>
      </div>
    );

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-ink-2">
          Сөйлем {i + 1} / {sentences.length}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost h-9 px-3" onClick={() => speak(target, { rate: 0.8 })}>
            <Volume2 size={15} /> Тыңдау
          </button>
          <button className="btn btn-ghost h-9 px-3" onClick={() => speak(target, { rate: 0.6 })}>
            Баяу
          </button>
        </div>
      </div>
      <input
        className="input mt-4"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setResult(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && (result ? next() : check())}
        placeholder="Естігеніңізді түрікше жазыңыз…"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Диктант жауабы"
      />
      <TurkishKeys onKey={(k) => setValue((v) => v + k)} />
      {result && (
        <div className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${result === "exact" ? "bg-green-soft text-green" : result === "close" ? "bg-amber-soft text-amber" : "bg-rose-soft text-rose"}`}>
          {result === "wrong" ? <X size={16} className="mt-0.5" /> : <Check size={16} className="mt-0.5" />}
          <div>
            {result === "exact" ? "Тамаша — дәл дұрыс." : result === "close" ? "Дұрыс, бірақ түрік әріптеріне назар аударыңыз (ç, ğ, ı, ö, ş, ü)." : "Әлі емес."}
            <div className="mt-1 text-ink">
              Дұрысы: <span className="font-medium">{target}</span>
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        {result ? (
          <button className="btn btn-primary" onClick={next}>
            Келесі
          </button>
        ) : (
          <button className="btn btn-primary" onClick={check} disabled={!value.trim()}>
            Тексеру
          </button>
        )}
      </div>
    </div>
  );

  function next() {
    setI((x) => x + 1);
    setValue("");
    setResult(null);
  }
}

export function TurkishKeys({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Түрік әріптері">
      {["ç", "ğ", "ı", "İ", "ö", "ş", "ü"].map((k) => (
        <button key={k} type="button" className="h-8 w-8 rounded-lg border hairline bg-bg text-sm hover:border-teal" onClick={() => onKey(k)}>
          {k}
        </button>
      ))}
    </div>
  );
}
