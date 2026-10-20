import Link from "next/link";
import type { Metadata } from "next";
import { currentUser, isGuest } from "@/lib/auth";
import { q } from "@/lib/db";
import { EXAM_TYPES, type ExamResult, type ExamType } from "@/lib/exam";
import { getSettings } from "@/lib/settings";
import { LESSON_UNITS } from "@/content";
import { PageShell } from "@/components/shell";
import { StartExam } from "@/components/start-exam";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sınav" };

export default async function ExamCenter() {
  const user = await currentUser();
  const cfg = getSettings().exam;
  const history = q.all<{ id: number; type: ExamType; result: string; finished_at: string }>(
    "SELECT id, type, result, finished_at FROM exams WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 12",
    user.id,
  );
  const skills: ExamType[] = ["okuma", "dinleme", "yazma", "konusma"];
  const extra: ExamType[] = ["kelime", "gramer"];

  return (
    <PageShell userLabel={isGuest(user) ? "Қонақ" : (user.name ?? "")}>
      <div className="eyebrow">Sınav Merkezi</div>
      <h1 className="mt-2 font-serif text-4xl sm:text-5xl" style={{ fontWeight: 460 }}>
        Емтиханға дайындық
      </h1>
      <p className="mt-3 max-w-xl text-ink-2">
        Уақыты бар сынақ емтихандары. Оқу, тыңдау, грамматика және сөздік автоматты тексеріледі; жазу мен сөйлеуді AI жаттығу рубрикасымен бағалайды.
      </p>

      <section className="card mt-10 overflow-hidden">
        <div className="grid md:grid-cols-[1.2fr_1fr]">
          <div className="p-7 sm:p-8">
            <div className="eyebrow text-teal">Deneme Sınavı</div>
            <h2 className="mt-2 font-serif text-3xl">Толық сынақ емтиханы</h2>
            <p className="mt-2 text-sm text-ink-2">Төрт дағды + сөздік пен грамматика · шамамен {cfg.minutes.full} минут</p>
            <div className="mt-6">
              <StartExam type="full" label="Бастау" primary />
            </div>
          </div>
          <div className="grid grid-cols-2 border-t hairline md:border-l md:border-t-0">
            {skills.map((t, i) => (
              <div key={t} className={`p-5 ${i % 2 ? "" : "border-r hairline"} ${i < 2 ? "border-b hairline" : ""}`}>
                <div className="font-serif text-lg">{EXAM_TYPES[t].tr}</div>
                <div className="text-xs text-ink-3">{EXAM_TYPES[t].kz}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <h2 className="eyebrow mt-14">Бөлек дағды бойынша</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[...skills, ...extra].map((t) => (
          <div key={t} className="card flex items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <div className="font-serif text-xl">
                {EXAM_TYPES[t].tr} <span className="text-base text-ink-3">· {EXAM_TYPES[t].kz}</span>
              </div>
              <div className="mt-0.5 text-sm text-ink-2">{EXAM_TYPES[t].desc}</div>
            </div>
            <StartExam type={t} label="Бастау" />
          </div>
        ))}
      </div>

      <h2 className="eyebrow mt-14">Тарау тестілері</h2>
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border hairline bg-line sm:grid-cols-4">
        {LESSON_UNITS.map((u) => (
          <div key={u.id} className="flex flex-col gap-3 bg-surface p-5">
            <div>
              <span className="font-serif text-2xl text-ink-3">{u.id}</span>
              <div className="font-serif text-lg">{u.tr}</div>
            </div>
            <StartExam type="unite" unit={u.id} label="Тест" small />
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <section className="mt-14">
          <h2 className="eyebrow">Емтихан тарихы</h2>
          <ul className="mt-4 divide-y divide-[var(--line)] rounded-[14px] border hairline bg-surface">
            {history.map((h) => {
              const r = JSON.parse(h.result) as ExamResult;
              const pct = r.score.total ? Math.round((r.score.correct / r.score.total) * 100) : null;
              return (
                <li key={h.id}>
                  <Link href={`/sinav/${h.id}/sonuc`} className="flex items-center gap-4 px-5 py-4 hover:bg-bg">
                    <span className="flex-1">
                      <span className="font-medium">{EXAM_TYPES[h.type]?.kz}</span>
                      <span className="ml-2 text-xs text-ink-3">{h.finished_at.slice(0, 16)}</span>
                    </span>
                    <span className="tabular-nums text-ink-2">{pct !== null ? `${pct}%` : "AI бағалау"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <p className="mt-10 text-xs text-ink-3">
        Бұл — жаттығу емтихандары. Ресми университет емтиханының форматы мен бағалау критерийлері берілмегендіктен, құрылымды әкімші баптаулардан өзгерте алады.
      </p>
    </PageShell>
  );
}
