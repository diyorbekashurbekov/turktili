import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { currentUser, isGuest } from "@/lib/auth";
import { q } from "@/lib/db";
import { EXAM_TYPES, type ExamResult, type ExamType } from "@/lib/exam";
import { getPage, UNITS } from "@/content";
import { PageShell } from "@/components/shell";
import { FeedbackView, Rubric, type WritingFeedback } from "@/components/writing";
import type { SpeakingFeedback } from "@/components/speaking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Емтихан нәтижесі" };

const SKILL_KZ: Record<string, string> = { okuma: "Оқу", dinleme: "Тыңдау", gramer: "Грамматика", kelime: "Сөздік", yazma: "Жазу", konusma: "Сөйлеу" };

export default async function Result({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await currentUser();
  const row = q.get<{ type: ExamType; result: string | null; finished_at: string | null }>("SELECT type, result, finished_at FROM exams WHERE id = ? AND user_id = ?", id, user.id);
  if (!row) notFound();
  if (!row.finished_at || !row.result) redirect(`/sinav/${id}`);
  const r = JSON.parse(row.result) as ExamResult;
  const pct = r.score.total ? Math.round((r.score.correct / r.score.total) * 100) : null;
  const wrong = r.items.filter((i) => !i.correct);
  const wf = r.writing?.feedback as WritingFeedback | null | undefined;
  const sf = r.speaking?.feedback as SpeakingFeedback | null | undefined;

  return (
    <PageShell userLabel={isGuest(user) ? "Қонақ" : (user.name ?? "")}>
      <Link href="/sinav" className="text-sm text-ink-2 hover:text-ink">
        ← Емтихан орталығы
      </Link>
      <div className="mt-6 eyebrow">Емтихан есебі · {row.finished_at.slice(0, 16)}</div>
      <h1 className="mt-2 font-serif text-4xl">{EXAM_TYPES[row.type].kz}</h1>

      {pct !== null && (
        <div className="mt-8 flex items-end gap-6">
          <div className="font-serif text-7xl leading-none text-teal">{pct}%</div>
          <div className="pb-2 text-ink-2">
            {r.score.correct} / {r.score.total} дұрыс
            <div className="text-xs text-ink-3">Автоматты тексерілетін бөлімдер</div>
          </div>
        </div>
      )}

      {Object.keys(r.bySkill).length > 0 && (
        <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(r.bySkill).map(([skill, s]) => (
            <div key={skill} className="card p-4">
              <div className="text-xs text-ink-3">{SKILL_KZ[skill] ?? skill}</div>
              <div className="mt-1 font-serif text-2xl">
                {s.correct}/{s.total}
              </div>
              <div className="progress-track mt-3">
                <div className="progress-fill" style={{ width: `${(s.correct / s.total) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {(r.recommendedPages.length > 0 || r.weakUnits.length > 0) && (
        <section className="card mt-10 p-6">
          <div className="eyebrow">Ұсынылатын қайталау</div>
          {r.weakUnits.length > 0 && (
            <p className="mt-3 text-sm text-ink-2">
              Әлсіз тараулар:{" "}
              {r.weakUnits.map((u, i) => {
                const unit = UNITS.find((x) => x.id === u);
                return (
                  <Link key={u} href={`/pratik/${u}/gramer`} className="text-teal hover:underline">
                    {u}. {unit?.tr}
                    {i < r.weakUnits.length - 1 ? ", " : ""}
                  </Link>
                );
              })}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {r.recommendedPages.map((p) => (
              <Link key={p} href={`/kitap/${p}`} className="chip hover:border-teal hover:text-teal">
                {p}-бет · {getPage(p)?.title.slice(0, 28)}
              </Link>
            ))}
          </div>
          <Link href="/kelime/calis?set=due&mode=flash" className="btn btn-ghost mt-5 h-9">
            Сөздерді қайталау
          </Link>
        </section>
      )}

      {r.writing && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Жазу</h2>
          {wf ? <FeedbackView original={r.writing.text} f={wf} pages={[]} /> : <p className="mt-2 text-sm text-ink-2">AI бағалау қолжетімсіз болды{r.writing.text ? "; мәтін сақталды" : ""}.</p>}
        </section>
      )}
      {r.speaking && (
        <section className="mt-10">
          <h2 className="font-serif text-2xl">Сөйлеу</h2>
          {sf ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-teal-soft/60 p-4">{sf.summary_kz}</div>
              {sf.corrections.map((c, i) => (
                <div key={i} className="text-sm">
                  <span className="text-rose">{c.said}</span> → <span className="font-medium text-green">{c.better}</span>
                  <div className="text-ink-2">{c.explanation_kz}</div>
                </div>
              ))}
              <Rubric r={sf.rubric} labels={{ task: "Тапсырма", grammar: "Грамматика", vocabulary: "Сөздік", interaction: "Қарым-қатынас" }} />
              <p className="text-xs text-ink-3">{sf.pronunciation_note_kz} Айтылым акустикалық түрде өлшенбеді.</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-2">Ауызша бөлім бағаланбады.</p>
          )}
        </section>
      )}

      {wrong.length > 0 && (
        <section className="mt-12">
          <h2 className="font-serif text-2xl">Қателерді талдау</h2>
          <ul className="mt-4 space-y-3">
            {wrong.map((it) => (
              <li key={it.id} className="card p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full bg-rose-soft p-1 text-rose">
                    <X size={12} />
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{it.prompt}</div>
                    <div className="mt-2 text-sm">
                      <span className="text-ink-3">Сіздің жауабыңыз: </span>
                      <span className="text-rose">{it.given === null ? "—" : it.options ? it.options[it.given as number] : it.given ? "Doğru" : "Yanlış"}</span>
                      <span className="ml-3 text-ink-3">Дұрысы: </span>
                      <span className="text-green">{it.options ? it.options[it.answer as number] : it.answer ? "Doğru" : "Yanlış"}</span>
                    </div>
                    <p className="mt-2 text-sm text-ink-2">{it.explain}</p>
                    {it.pages.length > 0 && (
                      <div className="mt-2 text-xs text-ink-3">
                        Кітап:{" "}
                        {it.pages.map((p) => (
                          <Link key={p} href={`/kitap/${p}`} className="mr-1 text-teal hover:underline">
                            {p}-бет
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {wrong.length === 0 && r.score.total > 0 && (
        <p className="mt-10 inline-flex items-center gap-2 text-green">
          <Check size={16} /> Барлық автоматты тексерілген жауаптар дұрыс.
        </p>
      )}
      <p className="mt-12 text-xs text-ink-3">Жаттығу емтиханы. Жазу/сөйлеу бағасы — AI жаттығу рубрикасы, ресми балл емес.</p>
    </PageShell>
  );
}
