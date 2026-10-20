"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Loader2, X } from "lucide-react";
import type { ExamSection } from "@/lib/exam";
import { ExamQuestions } from "./questions";
import { DialoguePlayer } from "./listening";
import { WritingTask, type WritingFeedback } from "./writing";
import { SpeakingSession, type SpeakingFeedback } from "./speaking";
import { post } from "@/lib/client";

const SKILL_KZ: Record<string, string> = { okuma: "Оқу", dinleme: "Тыңдау", gramer: "Грамматика", kelime: "Сөздік", yazma: "Жазу", konusma: "Сөйлеу" };

export function ExamRunner({
  id,
  plan,
  title,
  startedAt,
  aiReady,
}: {
  id: number;
  plan: { minutes: number; sections: ExamSection[] };
  title: string;
  startedAt: string;
  aiReady: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | boolean>>({});
  const [writing, setWriting] = useState<{ text: string; feedback: WritingFeedback | null } | null>(null);
  const [speaking, setSpeaking] = useState<{ sessionId: number | null; feedback: SpeakingFeedback | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const deadline = useMemo(() => new Date(startedAt).getTime() + plan.minutes * 60_000, [startedAt, plan.minutes]);
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()));
  const submitted = useRef(false);
  const sections = plan.sections;
  const sec = sections[step];
  const totalQ = sections.reduce((s, x) => s + ("questions" in x && x.kind !== "speaking" ? x.questions.length : 0), 0);
  const answered = Object.keys(answers).length;

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      await post("/api/exams", { action: "submit", id, answers, writing, speaking });
      router.replace(`/sinav/${id}/sonuc`);
    } catch {
      submitted.current = false;
      setSubmitting(false);
    }
  }, [answers, id, router, speaking, writing]);

  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, deadline - Date.now());
      setLeft(l);
      if (l === 0) submit();
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, submit]);

  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const offset = sections.slice(0, step).reduce((s, x) => s + ("questions" in x && x.kind !== "speaking" ? x.questions.length : 0), 0);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b hairline bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-5">
          <Link href="/sinav" className="icon-btn" aria-label="Шығу">
            <X size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="text-xs text-ink-3">
              Бөлім {step + 1}/{sections.length} · {SKILL_KZ[sec.skill]}
              {totalQ ? ` · ${answered}/${totalQ} жауап` : ""}
            </div>
          </div>
          <div className={`chip tabular-nums ${left < 120_000 ? "border-rose/30 text-rose" : ""}`} aria-live="off">
            <Clock size={13} /> {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
        </div>
        <div className="progress-track rounded-none">
          <div className="progress-fill rounded-none" style={{ width: `${((step + 1) / sections.length) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-32 pt-8">
        <div className="eyebrow">{SKILL_KZ[sec.skill]}</div>
        {sec.kind === "reading" && (
          <>
            <h2 className="mt-2 font-serif text-2xl">{sec.title}</h2>
            <p className="card mt-5 p-6 font-serif text-[1.12rem] leading-[1.85]">{sec.text}</p>
            <div className="mt-6">
              <ExamQuestions questions={sec.questions} value={answers} onChange={(qid, v) => setAnswers((a) => ({ ...a, [qid]: v }))} offset={offset} />
            </div>
          </>
        )}
        {sec.kind === "listening" && (
          <>
            <h2 className="mt-2 font-serif text-2xl">{sec.title}</h2>
            <div className="mt-5">
              <DialoguePlayer lines={sec.lines} />
            </div>
            <div className="mt-6">
              <ExamQuestions questions={sec.questions} value={answers} onChange={(qid, v) => setAnswers((a) => ({ ...a, [qid]: v }))} offset={offset} />
            </div>
          </>
        )}
        {sec.kind === "mcq" && (
          <>
            <h2 className="mt-2 font-serif text-2xl">{sec.title}</h2>
            <div className="mt-6">
              <ExamQuestions questions={sec.questions} value={answers} onChange={(qid, v) => setAnswers((a) => ({ ...a, [qid]: v }))} offset={offset} />
            </div>
          </>
        )}
        {sec.kind === "writing" && (
          <div className="mt-4">
            {writing ? (
              <div className="card p-6 text-sm text-ink-2">Жазу тапсырмасы жіберілді{writing.feedback ? " және бағаланды" : " (AI бағасы қолжетімсіз — мәтін сақталды)"}. Нәтиже емтихан есебінде көрсетіледі.</div>
            ) : (
              <WritingTask task={sec.task} aiReady={aiReady} onResult={(r) => setWriting({ text: r.text, feedback: r.feedback ?? null })} />
            )}
            {!aiReady && !writing && (
              <button className="btn btn-ghost mt-3" onClick={() => setWriting({ text: "", feedback: null })}>
                Бұл бөлімді өткізу
              </button>
            )}
          </div>
        )}
        {sec.kind === "speaking" && (
          <div className="mt-4">
            {speaking ? (
              <div className="card p-6 text-sm text-ink-2">Ауызша бөлім аяқталды. Нәтиже емтихан есебінде.</div>
            ) : (
              <>
                <SpeakingSession topic={sec.topic} questions={sec.questions} aiReady={aiReady} examMode maxTurns={sec.questions.length} onFinish={(r) => setSpeaking({ sessionId: r.sessionId, feedback: r.feedback })} />
                {!aiReady && (
                  <button className="btn btn-ghost mt-3" onClick={() => setSpeaking({ sessionId: null, feedback: null })}>
                    Бұл бөлімді өткізу
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t hairline bg-bg/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <button className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Артқа
          </button>
          {step < sections.length - 1 ? (
            <button className="btn btn-primary" onClick={() => (window.scrollTo({ top: 0 }), setStep((s) => s + 1))}>
              Келесі бөлім
            </button>
          ) : (
            <button className="btn btn-teal" onClick={submit} disabled={submitting}>
              {submitting && <Loader2 size={15} className="animate-spin" />} Емтиханды аяқтау
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
