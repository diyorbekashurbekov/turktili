"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, Volume2, X } from "lucide-react";
import { speak } from "@/lib/speech";
import { foldTr, normTr, track } from "@/lib/client";
import { ttsText } from "./speak-button";
import { TurkishKeys } from "./listening";

type W = { id: string; tr: string; kz: string; page: number; options?: { tr: string; kz: string }[] };
type Mode = "flash" | "tr-kz" | "kz-tr" | "listen" | "spell" | "match";

const TITLES: Record<Mode, string> = {
  flash: "Карточкалар",
  "tr-kz": "Түрікше → қазақша",
  "kz-tr": "Қазақша → түрікше",
  listen: "Тыңдап таңдау",
  spell: "Емле",
  match: "Сәйкестендіру",
};

function grade(wordId: string, g: 0 | 1 | 2 | 3) {
  track({ type: "vocab-review", wordId, grade: g });
  track({ type: "attempts", skill: "kelime", unit: null, items: [{ itemId: wordId, correct: g > 0 }] });
}

export function VocabSession({ words, mode, back, set }: { words: W[]; mode: Mode; back: string; set: string }) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const router = useRouter();
  const done = mode === "match" ? results.length > 0 : i >= words.length;

  const record = (ok: boolean) => {
    setResults((r) => [...r, ok]);
    setI((x) => x + 1);
  };

  if (!words.length)
    return (
      <Frame back={back} title={TITLES[mode]}>
        <div className="py-20 text-center">
          <p className="font-serif text-2xl">Қазір жаттығатын сөз жоқ</p>
          <p className="mt-2 text-ink-2">{set === "due" ? "Барлық қайталау орындалды. Жаңа тарауды бастаңыз." : "Бұл топта сөз табылмады."}</p>
          <Link href="/kelime" className="btn btn-primary mt-8">
            Kelime Dünyası
          </Link>
        </div>
      </Frame>
    );

  return (
    <Frame back={back} title={TITLES[mode]} progress={mode === "match" ? (done ? 1 : 0) : i / words.length}>
      {done ? (
        <Summary results={results} total={mode === "match" ? words.length : words.length} onAgain={() => { setI(0); setResults([]); router.refresh(); }} back={back} mode={mode} />
      ) : mode === "match" ? (
        <Match words={words} onDone={(errors) => setResults(words.map((_, k) => k < words.length - Math.min(errors, words.length)))} />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25, ease: [0.22, 0.8, 0.24, 1] }}>
            {mode === "flash" && <Flash w={words[i]} onGrade={(g) => (grade(words[i].id, g), record(g > 0))} />}
            {(mode === "tr-kz" || mode === "kz-tr" || mode === "listen") && <Choice w={words[i]} mode={mode} onAnswer={(ok) => (grade(words[i].id, ok ? 2 : 0), record(ok))} />}
            {mode === "spell" && <Spell w={words[i]} onAnswer={(g) => (grade(words[i].id, g), record(g > 0))} />}
          </motion.div>
        </AnimatePresence>
      )}
    </Frame>
  );
}

function Frame({ children, back, title, progress }: { children: React.ReactNode; back: string; title: string; progress?: number }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center gap-4 px-5 pt-5">
        <Link href={back} className="icon-btn" aria-label="Шығу">
          <X size={19} />
        </Link>
        <div className="progress-track flex-1">
          <div className="progress-fill" style={{ width: `${(progress ?? 0) * 100}%` }} />
        </div>
        <span className="text-xs text-ink-3">{title}</span>
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-16 pt-10 sm:pt-16">{children}</main>
    </div>
  );
}

function Flash({ w, onGrade }: { w: W; onGrade: (g: 0 | 1 | 2 | 3) => void }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    speak(ttsText(w.tr));
  }, [w.tr]);
  return (
    <div>
      <button
        onClick={() => setFlipped(true)}
        className="card relative flex min-h-[300px] w-full flex-col items-center justify-center p-8 text-center transition-colors hover:border-line-2"
        aria-label="Карточканы аудару"
      >
        <div className="font-serif text-[2.2rem] leading-tight sm:text-[2.6rem]">{w.tr}</div>
        <AnimatePresence>
          {flipped ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-xl text-ink-2">
              {w.kz}
              <div className="mt-3 text-xs text-ink-3">{w.page}-бет</div>
            </motion.div>
          ) : (
            <div className="mt-6 text-sm text-ink-3">Мағынасын еске түсіріп, басыңыз</div>
          )}
        </AnimatePresence>
        <span
          role="button"
          tabIndex={0}
          className="icon-btn absolute right-3 top-3"
          onClick={(e) => {
            e.stopPropagation();
            speak(ttsText(w.tr));
          }}
          aria-label="Тыңдау"
        >
          <Volume2 size={18} />
        </span>
      </button>
      <div className={`mt-6 grid grid-cols-4 gap-2 transition-opacity ${flipped ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        {(
          [
            [0, "Қайта", "text-rose"],
            [1, "Қиын", "text-amber"],
            [2, "Жақсы", "text-teal"],
            [3, "Оңай", "text-green"],
          ] as const
        ).map(([g, label, cls]) => (
          <button key={g} className={`btn btn-ghost h-12 ${cls}`} onClick={() => onGrade(g)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Choice({ w, mode, onAnswer }: { w: W; mode: "tr-kz" | "kz-tr" | "listen"; onAnswer: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const options = w.options ?? [{ tr: w.tr, kz: w.kz }];
  const correctIdx = options.findIndex((o) => o.tr === w.tr);
  useEffect(() => {
    if (mode !== "kz-tr") speak(ttsText(w.tr));
  }, [w.tr, mode]);
  const pick = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    if (mode === "kz-tr") speak(ttsText(w.tr));
    setTimeout(() => onAnswer(k === correctIdx), k === correctIdx ? 650 : 1500);
  };
  return (
    <div>
      <div className="text-center">
        {mode === "listen" ? (
          <button className="btn btn-teal mx-auto h-20 w-20 rounded-full p-0" onClick={() => speak(ttsText(w.tr))} aria-label="Қайта тыңдау">
            <Volume2 size={28} />
          </button>
        ) : (
          <div className="font-serif text-[2.2rem] leading-tight">{mode === "tr-kz" ? w.tr : w.kz}</div>
        )}
        <div className="mt-3 text-sm text-ink-3">{mode === "listen" ? "Естіген сөздің мағынасын таңдаңыз" : mode === "tr-kz" ? "Қазақша аудармасы" : "Түрікшесі"}</div>
      </div>
      <div className="mt-10 grid gap-2.5">
        {options.map((o, k) => {
          const label = mode === "kz-tr" ? o.tr : o.kz;
          const state = picked === null ? "idle" : k === correctIdx ? "right" : k === picked ? "wrong" : "dim";
          return (
            <button
              key={k}
              onClick={() => pick(k)}
              className={`flex items-center justify-between rounded-[14px] border px-5 py-4 text-left text-[1.02rem] transition-colors ${
                state === "idle" ? "border-line bg-surface hover:border-teal" : state === "right" ? "border-green/30 bg-green-soft text-green" : state === "wrong" ? "border-rose/30 bg-rose-soft text-rose" : "border-line bg-surface text-ink-3"
              }`}
            >
              {label}
              {state === "right" && <Check size={18} />}
              {state === "wrong" && <X size={18} />}
            </button>
          );
        })}
      </div>
      {picked !== null && mode === "listen" && <p className="mt-4 text-center text-sm text-ink-2">{w.tr}</p>}
    </div>
  );
}

function Spell({ w, onAnswer }: { w: W; onAnswer: (g: 0 | 1 | 2) => void }) {
  const target = ttsText(w.tr);
  const [v, setV] = useState("");
  const [res, setRes] = useState<null | 0 | 1 | 2>(null);
  const check = () => {
    const g = normTr(v) === normTr(target) ? 2 : foldTr(v) === foldTr(target) ? 1 : 0;
    setRes(g);
    speak(target);
  };
  return (
    <div className="text-center">
      <div className="font-serif text-[2rem] leading-tight">{w.kz}</div>
      <div className="mt-2 text-sm text-ink-3">Түрікше жазыңыз</div>
      <input
        className="input mx-auto mt-8 h-14 max-w-md text-center text-xl"
        value={v}
        autoFocus
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (res === null ? check() : onAnswer(res))}
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Түрікше жауап"
      />
      <div className="flex justify-center">
        <TurkishKeys onKey={(k) => setV((x) => x + k)} />
      </div>
      {res !== null && (
        <div className={`mx-auto mt-6 max-w-md rounded-xl px-4 py-3 text-sm ${res === 2 ? "bg-green-soft text-green" : res === 1 ? "bg-amber-soft text-amber" : "bg-rose-soft text-rose"}`}>
          {res === 2 ? "Дұрыс!" : res === 1 ? "Дерлік — түрік әріптерін тексеріңіз." : "Қате."} <span className="text-ink">Дұрысы: {target}</span>
        </div>
      )}
      <div className="mt-6">
        {res === null ? (
          <button className="btn btn-primary" onClick={check} disabled={!v.trim()}>
            Тексеру
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => onAnswer(res)}>
            Келесі
          </button>
        )}
      </div>
    </div>
  );
}

function Match({ words, onDone }: { words: W[]; onDone: (errors: number) => void }) {
  const left = useMemo(() => words.map((w) => ({ id: w.id, label: ttsText(w.tr) })), [words]);
  const right = useMemo(() => [...words].sort((a, b) => a.kz.localeCompare(b.kz)).map((w) => ({ id: w.id, label: w.kz })), [words]);
  const [selL, setSelL] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const [errors, setErrors] = useState(0);

  const pickRight = (id: string) => {
    if (!selL || matched.includes(id)) return;
    if (id === selL) {
      const m = [...matched, id];
      setMatched(m);
      grade(id, 2);
      setSelL(null);
      if (m.length === words.length) setTimeout(() => onDone(errors), 500);
    } else {
      setWrong(id);
      setErrors((e) => e + 1);
      grade(selL, 0);
      setTimeout(() => setWrong(null), 600);
    }
  };

  return (
    <div>
      <p className="text-center text-sm text-ink-3">Сол жақтағы сөзді, кейін оның аудармасын таңдаңыз</p>
      <div className="mt-8 grid grid-cols-2 gap-3">
        <div className="space-y-2.5">
          {left.map((l) => (
            <button
              key={l.id}
              disabled={matched.includes(l.id)}
              onClick={() => {
                setSelL(l.id);
                speak(l.label);
              }}
              className={`w-full rounded-[12px] border px-4 py-3.5 text-left transition-all ${matched.includes(l.id) ? "border-transparent bg-green-soft text-green opacity-60" : selL === l.id ? "border-teal bg-teal-soft" : "border-line bg-surface hover:border-line-2"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="space-y-2.5">
          {right.map((r) => (
            <button
              key={r.id}
              disabled={matched.includes(r.id)}
              onClick={() => pickRight(r.id)}
              className={`w-full rounded-[12px] border px-4 py-3.5 text-left text-[0.95rem] transition-all ${matched.includes(r.id) ? "border-transparent bg-green-soft text-green opacity-60" : wrong === r.id ? "border-rose/40 bg-rose-soft" : "border-line bg-surface hover:border-line-2"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Summary({ results, total, onAgain, back, mode }: { results: boolean[]; total: number; onAgain: () => void; back: string; mode: Mode }) {
  const ok = results.filter(Boolean).length;
  return (
    <div className="py-10 text-center">
      <div className="eyebrow">Жаттығу аяқталды</div>
      <div className="mt-4 font-serif text-6xl">
        {ok}
        <span className="text-ink-3">/{total}</span>
      </div>
      <p className="mt-4 text-ink-2">{ok === total ? "Керемет — бәрі дұрыс." : "Қате сөздер жақын арада қайта шығады (spaced repetition)."}</p>
      <div className="mt-10 flex justify-center gap-3">
        <Link href={back} className="btn btn-ghost">
          Артқа
        </Link>
        <button className="btn btn-primary" onClick={onAgain}>
          {mode === "match" ? "Жаңа жұптар" : "Тағы бір топ"}
        </button>
      </div>
    </div>
  );
}
