"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import type { Question } from "@/content/practice";
import { track } from "@/lib/client";

export type ExamQuestion =
  | { id: string; type: "mcq"; prompt: string; options: string[] }
  | { id: string; type: "tf"; prompt: string };

/** Practice mode: instant feedback with explanation and textbook pages. */
export function PracticeQuestions({ questions, skill, unit, onDone }: { questions: Question[]; skill: string; unit: number; onDone?: (score: number) => void }) {
  const [answers, setAnswers] = useState<Record<string, number | boolean>>({});
  const answered = Object.keys(answers).length;
  const correct = questions.filter((q) => answers[q.id] !== undefined && isRight(q, answers[q.id])).length;

  const choose = (q: Question, value: number | boolean) => {
    if (answers[q.id] !== undefined) return;
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    const right = isRight(q, value);
    track({
      type: "attempts",
      skill,
      unit,
      items: [{ itemId: q.id, correct: right, given: q.type === "mcq" ? q.options[value as number] : String(value) }],
    });
    if (Object.keys(next).length === questions.length) onDone?.(questions.filter((x) => isRight(x, next[x.id])).length);
  };

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => {
        const given = answers[q.id];
        const done = given !== undefined;
        const right = done && isRight(q, given);
        return (
          <div key={q.id} className="card p-5 sm:p-6">
            <div className="flex gap-3">
              <span className="pt-0.5 text-sm tabular-nums text-ink-3">{idx + 1}.</span>
              <p className="flex-1 text-[1.02rem] font-medium leading-snug">{q.prompt}</p>
            </div>
            <div className={`mt-4 grid gap-2 ${q.type === "tf" ? "grid-cols-2" : "sm:grid-cols-2"}`}>
              {(q.type === "mcq" ? q.options.map((o, i) => [i, o] as const) : ([[true, "Doğru · Дұрыс"], [false, "Yanlış · Қате"]] as const)).map(([val, label]) => {
                const chosen = given === val;
                const isAnswer = q.type === "mcq" ? q.answer === val : q.answer === val;
                const state = !done ? "idle" : isAnswer ? "right" : chosen ? "wrong" : "dim";
                return (
                  <button
                    key={String(val)}
                    onClick={() => choose(q, val)}
                    disabled={done}
                    className={`flex items-center justify-between gap-3 rounded-[12px] border px-4 py-3 text-left text-[0.95rem] transition-colors ${
                      state === "idle"
                        ? "border-line bg-bg hover:border-teal hover:bg-surface"
                        : state === "right"
                          ? "border-green/30 bg-green-soft text-green"
                          : state === "wrong"
                            ? "border-rose/30 bg-rose-soft text-rose"
                            : "border-line bg-bg text-ink-3"
                    }`}
                  >
                    <span>{label}</span>
                    {state === "right" && <Check size={16} />}
                    {state === "wrong" && <X size={16} />}
                  </button>
                );
              })}
            </div>
            {done && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-[12px] px-4 py-3 text-sm ${right ? "bg-green-soft/60 text-ink-2" : "bg-rose-soft/60 text-ink"}`}>
                <span className="font-semibold">{right ? "Дұрыс. " : "Қате. "}</span>
                {q.explain}
                {q.pages?.length ? (
                  <span className="ml-1 text-ink-3">
                    Кітап:{" "}
                    {q.pages.map((p, i) => (
                      <Link key={p} href={`/kitap/${p}`} className="text-teal hover:underline">
                        {p}
                        {i < q.pages!.length - 1 ? ", " : ""}
                      </Link>
                    ))}
                    -бет.
                  </span>
                ) : null}
              </motion.div>
            )}
          </div>
        );
      })}
      {answered === questions.length && (
        <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="eyebrow">Нәтиже</div>
            <div className="mt-1 font-serif text-2xl">
              {correct} / {questions.length}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => setAnswers({})}>
            Қайта орындау
          </button>
        </div>
      )}
    </div>
  );
}

export function isRight(q: Question, v: number | boolean) {
  return q.type === "mcq" ? q.answer === v : q.answer === v;
}

/** Exam mode: no feedback; parent collects answers and the server grades. */
export function ExamQuestions({ questions, value, onChange, offset = 0 }: { questions: ExamQuestion[]; value: Record<string, number | boolean>; onChange: (id: string, v: number | boolean) => void; offset?: number }) {
  return (
    <div className="space-y-4">
      {questions.map((q, idx) => (
        <div key={q.id} className="card p-5">
          <div className="flex gap-3">
            <span className="pt-0.5 text-sm tabular-nums text-ink-3">{offset + idx + 1}.</span>
            <p className="flex-1 font-medium leading-snug">{q.prompt}</p>
          </div>
          <div className={`mt-4 grid gap-2 ${q.type === "tf" ? "grid-cols-2" : "sm:grid-cols-2"}`}>
            {(q.type === "mcq" ? q.options.map((o, i) => [i, o] as const) : ([[true, "Doğru · Дұрыс"], [false, "Yanlış · Қате"]] as const)).map(([val, label]) => {
              const chosen = value[q.id] === val;
              return (
                <button
                  key={String(val)}
                  onClick={() => onChange(q.id, val)}
                  className={`rounded-[12px] border px-4 py-3 text-left text-[0.95rem] transition-colors ${chosen ? "border-teal bg-teal-soft text-teal-ink" : "border-line bg-bg hover:border-line-2"}`}
                  aria-pressed={chosen}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
