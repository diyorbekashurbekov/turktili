import Link from "next/link";
import { ArrowRight, Sparkles, Target } from "lucide-react";
import { currentUser, isGuest } from "@/lib/auth";
import { getPage, LESSON_UNITS } from "@/content";
import { overview } from "@/lib/progress";
import { BookHero } from "@/components/book-cover";
import { BottomNav, TopBar } from "@/components/shell";
import { Greeting, ExamCountdown } from "@/components/home-bits";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const ov = await overview(user.id);
  const last = user.last_page ? await getPage(user.last_page) : null;
  const firstName = user.name?.split(" ")[0] ?? null;
  const pct = Math.round((ov.pagesCompleted / 192) * 100);

  return (
    <>
      <TopBar userLabel={isGuest(user) ? "Қонақ" : (user.name ?? user.email ?? "")} />
      <main className="mx-auto max-w-6xl px-4 pb-28 sm:px-6 md:pb-16">
        <section className="grid items-center gap-12 pt-10 md:min-h-[calc(100dvh-3.5rem)] md:grid-cols-[1.05fr_1fr] md:gap-16 md:pt-0">
          <div className="order-2 md:order-1">
            <div className="rise">
              <Greeting name={firstName} />
            </div>
            <h1 className="rise rise-1 mt-4 font-serif text-[2.4rem] leading-[1.08] tracking-[-0.01em] sm:text-[3.4rem]" style={{ fontWeight: 480 }}>
              Бір кітап.
              <br />
              <span className="text-ink-2">Төрт дағды.</span>
              <br />
              Бір мұғалім.
            </h1>
            <p className="rise rise-2 mt-5 max-w-md text-[1.02rem] leading-relaxed text-ink-2">
              Yedi İklim Türkçe A1 оқулығының 192 беті — интерактивті сабақ, сөздік, жаттығу және AI мұғалім ретінде.
            </p>

            <div className="rise rise-3 mt-8 flex flex-wrap items-center gap-3">
              <Link href={last ? `/kitap/${last.n}` : "/kitap"} className="btn btn-primary h-12 px-6 text-[0.95rem]">
                {last ? "Оқуды жалғастыру" : "Kitabı Aç"}
                <ArrowRight size={17} />
              </Link>
              <Link href="/odak" className="btn btn-ghost h-12 px-5">
                <Target size={17} /> Фокус режимі
              </Link>
            </div>

            {last && (
              <Link href={`/kitap/${last.n}`} className="rise rise-4 group mt-8 flex max-w-md items-center gap-4 border-t hairline pt-5">
                <div className="font-serif text-3xl text-teal">{last.n}</div>
                <div className="min-w-0 flex-1">
                  <div className="eyebrow">Соңғы бет</div>
                  <div className="truncate text-[0.95rem] text-ink">{last.title}</div>
                </div>
                <ArrowRight size={16} className="text-ink-3 transition-transform group-hover:translate-x-1" />
              </Link>
            )}

            <div className="rise rise-4 mt-6 flex max-w-md flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-2">
              <ExamCountdown examDate={user.exam_date} />
              <Link href="/ogretmen" className="inline-flex items-center gap-1.5 hover:text-teal">
                <Sparkles size={15} className="text-teal" /> AI мұғалім
              </Link>
            </div>
          </div>

          <div className="order-1 flex flex-col items-center md:order-2">
            <BookHero href={last ? `/kitap/${last.n}` : "/kitap"} />
            <div className="mt-8 w-[min(66vw,300px)] sm:w-[320px]">
              <div className="flex justify-between text-xs text-ink-3">
                <span>Кітап бойынша прогресс</span>
                <span>{ov.pagesCompleted} / 192 бет</span>
              </div>
              <div className="progress-track mt-2">
                <div className="progress-fill" style={{ width: `${Math.max(pct, 1)}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20 md:mt-4" aria-labelledby="units-h">
          <div className="flex items-end justify-between">
            <h2 id="units-h" className="eyebrow">
              Тараулар
            </h2>
            <Link href="/kitap" className="text-sm text-ink-2 hover:text-teal">
              Мазмұны
            </Link>
          </div>
          <ol className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border hairline bg-line sm:grid-cols-4">
            {LESSON_UNITS.map((u) => {
              const st = ov.units.find((x) => x.unit === u.id)!;
              const p = st.pagesDone / st.pagesTotal;
              return (
                <li key={u.id} className="bg-surface">
                  <Link href={`/kitap/${u.from}`} className="group block p-5 transition-colors hover:bg-bg">
                    <div className="flex items-baseline justify-between">
                      <span className="font-serif text-2xl text-ink-3 group-hover:text-teal">{u.id}</span>
                      <span className="text-xs text-ink-3">
                        {u.from}–{u.to}
                      </span>
                    </div>
                    <div className="mt-3 font-serif text-lg leading-tight">{u.tr}</div>
                    <div className="text-sm text-ink-3">{u.kz}</div>
                    <div className="progress-track mt-4">
                      <div className="progress-fill" style={{ width: `${p * 100}%` }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
