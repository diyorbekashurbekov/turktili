import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Bookmark } from "lucide-react";
import { currentUser, isGuest } from "@/lib/auth";
import { getPage, LESSON_UNITS, UNITS } from "@/content";
import { pageStatuses } from "@/lib/progress";
import { q } from "@/lib/db";
import { PageShell } from "@/components/shell";
import { BookObject } from "@/components/book-cover";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "İçindekiler" };

export default async function Contents() {
  const user = await currentUser();
  const st = await pageStatuses(user.id);
  const bookmarks = await q.all<{ page: number }>("SELECT page FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC", user.id);
  const last = user.last_page ? await getPage(user.last_page) : null;
  const front = UNITS[0];
  const back = UNITS[9];

  return (
    <PageShell userLabel={isGuest(user) ? "Қонақ" : (user.name ?? "")} wide>
      <div className="grid gap-12 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center gap-5 lg:block">
            <BookObject className="w-28 shrink-0 lg:w-48" />
            <div className="lg:mt-8">
              <div className="eyebrow">Yunus Emre Enstitüsü</div>
              <h1 className="mt-2 font-serif text-3xl leading-tight">Yedi İklim Türkçe A1</h1>
              <p className="mt-2 text-sm text-ink-2">192 бет · 8 тарау · барлық беттер талданған</p>
            </div>
          </div>
          {last && (
            <Link href={`/kitap/${last.n}`} className="btn btn-primary mt-6 w-full justify-between px-5">
              {last.n}-беттен жалғастыру <ArrowRight size={16} />
            </Link>
          )}
          {bookmarks.length > 0 && (
            <div className="mt-8">
              <div className="eyebrow flex items-center gap-1.5">
                <Bookmark size={12} /> Бетбелгілер
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {bookmarks.map((b) => (
                  <Link key={b.page} href={`/kitap/${b.page}`} className="chip hover:border-teal hover:text-teal">
                    {b.page}-бет
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div>
          <div className="eyebrow">İçindekiler · Мазмұны</div>
          <div className="mt-6 divide-y divide-[var(--line)] border-y hairline">
            <TocRow href={`/kitap/${front.from}`} num="" title="Giriş" kz="Мұқаба, алғы сөз, мазмұны" range={`${front.from}–${front.to}`} />
            {LESSON_UNITS.map((u) => {
              let done = 0;
              for (let n = u.from; n <= u.to; n++) if (st[n] === "completed") done++;
              const total = u.to - u.from + 1;
              return (
                <section key={u.id} className="py-6">
                  <Link href={`/kitap/${u.from}`} className="group flex items-baseline gap-5">
                    <span className="w-8 font-serif text-3xl text-ink-3 transition-colors group-hover:text-teal">{u.id}</span>
                    <span className="flex-1">
                      <span className="font-serif text-2xl">{u.tr}</span>
                      <span className="ml-3 text-sm text-ink-3">{u.kz}</span>
                    </span>
                    <span className="hidden text-sm tabular-nums text-ink-3 sm:inline">
                      {done}/{total}
                    </span>
                  </Link>
                  <div className="ml-13 mt-4 grid gap-1 pl-[3.25rem] sm:grid-cols-3">
                    {u.sections.map((s) => (
                      <Link key={s.code} href={`/kitap/${s.start}`} className="flex items-baseline gap-2 rounded-lg py-1.5 text-[0.95rem] text-ink-2 hover:text-teal">
                        <span className="text-xs font-semibold text-ink-3">{s.code}</span>
                        <span className="flex-1">{s.title}</span>
                        <span className="text-xs tabular-nums text-ink-3">{s.start}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 pl-[3.25rem] text-xs text-ink-3">
                    {u.grammar.map((g) => (
                      <span key={g}>{g}</span>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-0.5 pl-[3.25rem]" aria-label={`${done} бет аяқталды`}>
                    {Array.from({ length: total }, (_, i) => {
                      const n = u.from + i;
                      const s = st[n];
                      return (
                        <Link
                          key={n}
                          href={`/kitap/${n}`}
                          title={`${n}-бет`}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${s === "completed" ? "bg-teal" : s === "visited" ? "bg-teal/35" : "bg-surface-2 hover:bg-line-2"}`}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
            <TocRow href={`/kitap/${back.from + 1}`} num="" title="Dizin · Dil Bilgisi" kz="Сөздер көрсеткіші, грамматика жиынтығы" range={`${back.from}–${back.to}`} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function TocRow({ href, num, title, kz, range }: { href: string; num: string; title: string; kz: string; range: string }) {
  return (
    <Link href={href} className="group flex items-baseline gap-5 py-5">
      <span className="w-8 font-serif text-2xl text-ink-3">{num}</span>
      <span className="flex-1">
        <span className="font-serif text-xl text-ink-2 group-hover:text-teal">{title}</span>
        <span className="ml-3 text-sm text-ink-3">{kz}</span>
      </span>
      <span className="text-sm tabular-nums text-ink-3">{range}</span>
    </Link>
  );
}
