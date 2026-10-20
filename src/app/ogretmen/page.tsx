import Link from "next/link";
import type { Metadata } from "next";
import { currentUser, isGuest } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai";
import { getPage, LESSON_UNITS } from "@/content";
import { TopBar, BottomNav } from "@/components/shell";
import { AiChat } from "@/components/ai-chat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Öğretmen" };

export default async function Teacher() {
  const user = await currentUser();
  const last = user.last_page ? getPage(user.last_page) : null;
  return (
    <>
      <TopBar userLabel={isGuest(user) ? "Қонақ" : (user.name ?? "")} />
      <main className="mx-auto grid max-w-6xl gap-10 px-4 pb-24 pt-8 sm:px-6 md:pb-8 lg:grid-cols-[1fr_300px]">
        <section className="flex h-[calc(100dvh-9rem)] min-h-[480px] flex-col md:h-[calc(100dvh-6rem)]">
          <div>
            <div className="eyebrow">Yedi İklim Öğretmeni</div>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">AI мұғалім</h1>
          </div>
          <div className="mt-4 min-h-0 flex-1">
            <AiChat
              page={last?.n ?? null}
              aiReady={aiConfigured()}
              intro={last ? `Соңғы ашқан бетіңіз — ${last.n}. Сол бет бойынша немесе кез келген тақырыпта сұраңыз.` : undefined}
            />
          </div>
        </section>
        <aside className="hidden space-y-8 lg:block">
          <div>
            <div className="eyebrow">Сөйлеу серіктесі</div>
            <p className="mt-2 text-sm text-ink-2">Микрофон арқылы түрікше сөйлесу — тараулардың тақырыбы бойынша.</p>
            <ul className="mt-3 space-y-1">
              {LESSON_UNITS.map((u) => (
                <li key={u.id}>
                  <Link href={`/pratik/${u.id}/konusma`} className="flex items-baseline gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                    <span className="w-4 text-ink-3">{u.id}</span>
                    {u.tr}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="eyebrow">Жазу тексеруі</div>
            <p className="mt-2 text-sm text-ink-2">Шағын мәтін жазып, толық AI кері байланысын алыңыз.</p>
            <Link href="/pratik/1/yazma" className="btn btn-ghost mt-3 h-9">
              Жазуды бастау
            </Link>
          </div>
          <p className="text-xs leading-relaxed text-ink-3">
            Мұғалім кітаптың тексерілген талдауына сүйенеді және дереккөзді көрсетеді. Өзі ойлап тапқан мысалдарды «Мысал (платформа)» деп белгілейді.
          </p>
        </aside>
      </main>
      <BottomNav />
    </>
  );
}
