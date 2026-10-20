"use client";

import { useState } from "react";
import type { UnitPractice } from "@/content/practice";
import { PracticeQuestions } from "./questions";
import { TappableText } from "./word-popover";
import { DialoguePlayer, Dictation } from "./listening";
import { FeedbackView, WritingTask, type WritingFeedback } from "./writing";
import { SpeakingSession } from "./speaking";

export function PracticeView({
  skill,
  practice,
  aiReady,
  history,
}: {
  skill: "okuma" | "dinleme" | "gramer" | "yazma" | "konusma";
  practice: UnitPractice;
  aiReady: boolean;
  history: { id: number; prompt_id: string; text: string; feedback: string | null; created_at: string }[];
}) {
  const u = practice.unit;

  if (skill === "okuma")
    return (
      <div className="space-y-8">
        <article className="card p-6 sm:p-8">
          <div className="eyebrow">Оқу мәтіні</div>
          <h2 className="mt-2 font-serif text-2xl">{practice.reading.title}</h2>
          <p className="mt-4 font-serif text-[1.18rem] leading-[1.85]">
            <TappableText text={practice.reading.text} />
          </p>
          <p className="mt-4 text-xs text-ink-3">Таныс емес сөзді басыңыз — мағынасы мен айтылуы шығады.</p>
        </article>
        <PracticeQuestions questions={practice.reading.questions} skill="okuma" unit={u} />
      </div>
    );

  if (skill === "dinleme")
    return (
      <div className="space-y-10">
        <section>
          <h2 className="mb-4 font-serif text-2xl">{practice.listening.title}</h2>
          <DialoguePlayer lines={practice.listening.lines} />
        </section>
        <section>
          <div className="eyebrow mb-4">Сұрақтар</div>
          <PracticeQuestions questions={practice.listening.questions} skill="dinleme" unit={u} />
        </section>
        <section>
          <div className="eyebrow mb-4">Диктант · Dikte</div>
          <Dictation sentences={practice.listening.dictation} unit={u} />
        </section>
      </div>
    );

  if (skill === "gramer") return <PracticeQuestions questions={practice.grammar} skill="gramer" unit={u} />;

  if (skill === "yazma") return <WritingSection practice={practice} aiReady={aiReady} history={history} />;

  return (
    <SpeakingSession
      topic={{ tr: practice.speaking.topic, kz: practice.speaking.kz }}
      questions={practice.speaking.questions}
      aiReady={aiReady}
    />
  );
}

function WritingSection({ practice, aiReady, history }: { practice: UnitPractice; aiReady: boolean; history: { id: number; prompt_id: string; text: string; feedback: string | null; created_at: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-6">
      {practice.writing.map((w) => (
        <WritingTask key={w.id} task={w} aiReady={aiReady} />
      ))}
      {history.length > 0 && (
        <section>
          <div className="eyebrow mb-3">Жазу тарихы</div>
          <ul className="divide-y divide-[var(--line)] rounded-[14px] border hairline bg-surface">
            {history.map((h) => {
              const task = practice.writing.find((w) => w.id === h.prompt_id);
              const fb = h.feedback ? (JSON.parse(h.feedback) as WritingFeedback) : null;
              return (
                <li key={h.id} className="p-4">
                  <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen(open === h.id ? null : h.id)}>
                    <span className="min-w-0 truncate text-sm">{task?.tr ?? h.prompt_id}</span>
                    <span className="shrink-0 text-xs text-ink-3">
                      {h.created_at.slice(0, 16)} · {fb ? "бағаланды" : "бағаланбаған"}
                    </span>
                  </button>
                  {open === h.id &&
                    (fb ? <FeedbackView original={h.text} f={fb} pages={task?.pages ?? []} /> : <p className="mt-3 whitespace-pre-wrap text-sm text-ink-2">{h.text}</p>)}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
