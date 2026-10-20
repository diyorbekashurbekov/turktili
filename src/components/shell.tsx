"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardCheck, Languages, Sparkles, Target, UserRound } from "lucide-react";

const NAV = [
  { href: "/kitap", label: "Kitap", kz: "Кітап", icon: BookOpen },
  { href: "/kelime", label: "Kelime", kz: "Сөздер", icon: Languages },
  { href: "/ogretmen", label: "Öğretmen", kz: "Мұғалім", icon: Sparkles },
  { href: "/sinav", label: "Sınav", kz: "Емтихан", icon: ClipboardCheck },
  { href: "/odak", label: "Odak", kz: "Фокус", icon: Target },
];

export function Wordmark() {
  return (
    <Link href="/" className="flex items-baseline gap-2" aria-label="Yedi İklim A1 — басты бет">
      <span className="font-serif text-[1.05rem] tracking-[0.14em]" style={{ fontWeight: 560 }}>
        YEDİ İKLİM
      </span>
      <span className="rounded-full bg-teal px-1.5 py-px text-[0.62rem] font-semibold tracking-wider text-white">A1</span>
    </Link>
  );
}

export function TopBar({ userLabel }: { userLabel?: string }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b hairline bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Wordmark />
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Негізгі мәзір">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${active ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"}`}
                aria-current={active ? "page" : undefined}
              >
                {n.kz}
              </Link>
            );
          })}
        </nav>
        <Link href="/hesap" className="icon-btn ml-auto md:ml-2" aria-label={userLabel ?? "Аккаунт"} title={userLabel}>
          <UserRound size={18} />
        </Link>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t hairline bg-bg/92 backdrop-blur-md md:hidden" aria-label="Негізгі мәзір">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {NAV.map((n) => {
          const active = path.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} className={`flex flex-col items-center justify-center gap-1 text-[0.68rem] ${active ? "text-teal" : "text-ink-3"}`} aria-current={active ? "page" : undefined}>
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
              {n.kz}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PageShell({ children, userLabel, wide = false }: { children: React.ReactNode; userLabel?: string; wide?: boolean }) {
  return (
    <>
      <TopBar userLabel={userLabel} />
      <main className={`mx-auto px-4 pb-28 pt-8 sm:px-6 md:pb-16 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>{children}</main>
      <BottomNav />
    </>
  );
}
