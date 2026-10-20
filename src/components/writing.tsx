"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { TurkishKeys } from "./listening";

export type WritingFeedback = {
  summary_kz: string;
  corrected_text: string;
  issues: { original: string; corrected: string; type: string; explanation_kz: string }[];
  strengths_kz: string[];
  next_steps_kz: string[];
  improved_example?: string;
  rubric: { task: number; grammar: number; vocabulary: number; coherence: number };
};

const TYPE_KZ: Record<string, string> = { grammar: "Грамматика", vocabulary: "Сөздік", spelling: "Емле", word_order: "Сөз тәртібі", punctuation: "Тыныс белгі" };

export function countSentences(t: string) {
  return t.split(/[.!?]+/).filter((s) => s.trim().split(/\s+/).length >= 2).length;
}

export function WritingTask({
  task,
  aiReady,
  onResult,
}: {
  task: { id: string; tr: string; kz: string; minSentences: number; focus: string; pages: number[] };
  aiReady: boolean;
  onResult?: (r: { id?: number; feedback?: WritingFeedback; text: string }) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sentences = countSentences(text);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/writing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptId: task.id, text }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error + (d.saved ? " Мәтініңіз сақталды." : ""));
      setFeedback(d.feedback);
      onResult?.({ id: d.id, feedback: d.feedback, text });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Қате");
      onResult?.({ text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="font-serif text-xl leading-snug">{task.tr}</div>
      <div className="mt-1 text-sm text-ink-2">{task.kz}</div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="chip">Кемінде {task.minSentences} сөйлем</span>
        <span className="chip">Назар: {task.focus}</span>
        {task.pages.map((p) => (
          <Link key={p} href={`/kitap/${p}`} className="chip hover:border-teal hover:text-teal">
            {p}-бет
          </Link>
        ))}
      </div>
      {!feedback && (
        <>
          <textarea className="input mt-5" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Türkçe yazın…" spellCheck={false} aria-label="Жазу жауабы" />
          <TurkishKeys onKey={(k) => setText((v) => v + k)} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className={`text-sm ${sentences >= task.minSentences ? "text-green" : "text-ink-3"}`}>
              {sentences} / {task.minSentences} сөйлем
            </span>
            <button className="btn btn-teal" onClick={submit} disabled={busy || text.trim().length < 10 || !aiReady}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} AI тексеруі
            </button>
          </div>
          {!aiReady && <p className="mt-3 text-sm text-amber">AI тексеруі әлі қосылмаған (серверде API кілті жоқ). Мәтінді жазып, мұғаліміңізге көрсете аласыз.</p>}
        </>
      )}
      {error && <div className="mt-4 rounded-xl bg-rose-soft px-4 py-3 text-sm text-rose">{error}</div>}
      {feedback && <FeedbackView original={text} f={feedback} pages={task.pages} onRetry={() => setFeedback(null)} />}
    </div>
  );
}

export function Rubric({ r, labels }: { r: Record<string, number>; labels: Record<string, string> }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(labels).map(([k, label]) => (
          <div key={k} className="rounded-xl border hairline bg-bg p-3">
            <div className="text-xs text-ink-3">{label}</div>
            <div className="mt-1 flex gap-1" aria-label={`${r[k]} / 4`}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < (r[k] ?? 0) ? "bg-teal" : "bg-surface-2"}`} />
              ))}
            </div>
            <div className="mt-1 text-sm tabular-nums">{r[k] ?? 0}/4</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-3">Жаттығу рубрикасы (AI бағасы) — ресми емтихан балы емес.</p>
    </div>
  );
}

export function FeedbackView({ original, f, pages, onRetry }: { original: string; f: WritingFeedback; pages: number[]; onRetry?: () => void }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl bg-teal-soft/60 p-4 text-[0.95rem] leading-relaxed">{f.summary_kz}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="eyebrow mb-2">Сіздің мәтініңіз</div>
          <p className="whitespace-pre-wrap rounded-xl border hairline bg-bg p-4 text-[0.95rem] leading-relaxed text-ink-2">{original}</p>
        </div>
        <div>
          <div className="eyebrow mb-2">Түзетілген нұсқа</div>
          <p className="whitespace-pre-wrap rounded-xl border border-teal/25 bg-surface p-4 text-[0.95rem] leading-relaxed">{f.corrected_text}</p>
        </div>
      </div>
      {f.issues.length > 0 && (
        <div>
          <div className="eyebrow mb-2">Түзетулер</div>
          <ul className="divide-y divide-[var(--line)] rounded-xl border hairline">
            {f.issues.map((it, i) => (
              <li key={i} className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-[0.95rem]">
                  <span className="text-rose line-through decoration-rose/50">{it.original}</span>
                  <span className="text-ink-3">→</span>
                  <span className="font-medium text-green">{it.corrected}</span>
                  <span className="chip ml-auto">{TYPE_KZ[it.type] ?? it.type}</span>
                </div>
                <p className="mt-1.5 text-sm text-ink-2">{it.explanation_kz}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {f.strengths_kz.length > 0 && (
          <div>
            <div className="eyebrow mb-2">Жақсы жақтары</div>
            <ul className="space-y-1.5 text-sm text-ink-2">
              {f.strengths_kz.map((s, i) => (
                <li key={i}>· {s}</li>
              ))}
            </ul>
          </div>
        )}
        {f.next_steps_kz.length > 0 && (
          <div>
            <div className="eyebrow mb-2">Келесі қадам</div>
            <ul className="space-y-1.5 text-sm text-ink-2">
              {f.next_steps_kz.map((s, i) => (
                <li key={i}>· {s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {f.improved_example && (
        <div>
          <div className="eyebrow mb-2">Үлгі мәтін (AI)</div>
          <p className="whitespace-pre-wrap rounded-xl border hairline bg-bg p-4 text-[0.95rem] leading-relaxed">{f.improved_example}</p>
        </div>
      )}
      <Rubric r={f.rubric} labels={{ task: "Тапсырма", grammar: "Грамматика", vocabulary: "Сөздік", coherence: "Байланыс" }} />
      <div className="flex flex-wrap gap-2">
        {pages.map((p) => (
          <Link key={p} href={`/kitap/${p}`} className="btn btn-ghost h-9">
            {p}-бетті қайталау
          </Link>
        ))}
        {onRetry && (
          <button className="btn btn-primary h-9" onClick={onRetry}>
            Қайта жазу
          </button>
        )}
      </div>
    </div>
  );
}
