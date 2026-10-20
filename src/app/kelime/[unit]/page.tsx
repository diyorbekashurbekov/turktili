import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Ear, Layers, Puzzle, Spline, Type, ArrowLeftRight } from "lucide-react";
import { currentUser, isGuest } from "@/lib/auth";
import { KELIME, UNITS, wordsForUnit } from "@/content";
import { q } from "@/lib/db";
import { PageShell } from "@/components/shell";
import { SpeakButton } from "@/components/speak-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kelime Dünyası" };

const MODES = [
  { mode: "flash", icon: Layers, tr: "Kartochkalar", kz: "Карточкалар", hint: "Сөзді көріп, мағынасын еске түсіріңіз" },
  { mode: "tr-kz", icon: ArrowLeftRight, tr: "Türkçe → Kazakça", kz: "Түрікше → қазақша", hint: "Дұрыс аударманы таңдаңыз" },
  { mode: "kz-tr", icon: Spline, tr: "Kazakça → Türkçe", kz: "Қазақша → түрікше", hint: "Түрік сөзін таңдаңыз" },
  { mode: "listen", icon: Ear, tr: "Dinle ve seç", kz: "Тыңдап таңдау", hint: "Естіген сөздің мағынасы" },
  { mode: "spell", icon: Type, tr: "Yaz", kz: "Емле", hint: "Қазақшасы бойынша түрікше жазу" },
  { mode: "match", icon: Puzzle, tr: "Eşleştir", kz: "Сәйкестендіру", hint: "Жұптарды табыңыз" },
];

export default async function UnitWords({ params }: { params: Promise<{ unit: string }> }) {
  const unitId = Number((await params).unit);
  const unit = UNITS.find((u) => u.id === unitId && u.id >= 1 && u.id <= 8);
  if (!unit) notFound();
  const user = await currentUser();
  const sets = KELIME.filter((k) => k.unit === unitId);
  const words = await wordsForUnit(unitId);
  const st = new Map((await q.all<{ word_id: string; interval_days: number; reps: number }>("SELECT word_id, interval_days, reps FROM vocab_state WHERE user_id = ?", user.id)).map((r) => [r.word_id, r]));
  const mark = (id: string | null) => {
    const s = id ? st.get(id) : undefined;
    return !s?.reps ? "bg-surface-2" : s.interval_days >= 4 ? "bg-teal" : "bg-teal/40";
  };

  return (
    <PageShell userLabel={isGuest(user) ? "Қонақ" : (user.name ?? "")}>
      <Link href="/kelime" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> Kelime Dünyası
      </Link>
      <div className="eyebrow mt-6">Ünite {unit.id}</div>
      <h1 className="mt-2 font-serif text-4xl">{unit.tr}</h1>
      <p className="mt-1 text-ink-2">
        {unit.kz} · {words.length} сөз
      </p>

      <h2 className="eyebrow mt-10">Жаттығу түрі</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        {MODES.map((m) => (
          <Link key={m.mode} href={`/kelime/calis?set=unit:${unitId}&mode=${m.mode}`} className="card group p-5 transition-colors hover:border-teal">
            <m.icon size={20} className="text-teal" />
            <div className="mt-4 font-medium">{m.kz}</div>
            <div className="mt-1 text-xs leading-relaxed text-ink-3">{m.hint}</div>
          </Link>
        ))}
      </div>

      {sets.map((s) => (
        <section key={s.page} className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-xl">
              Kelime Dünyası <span className="text-ink-3">· {s.page}-бет</span>
            </h2>
            <Link href={`/kitap/${s.page}`} className="text-sm text-teal hover:underline">
              Бетті ашу
            </Link>
          </div>
          <div className="mt-4 grid gap-px overflow-hidden rounded-[14px] border hairline bg-line sm:grid-cols-2">
            {s.items.map((it) => (
              <div key={it.tr} className="flex items-center gap-3 bg-surface px-4 py-3">
                <SpeakButton text={it.tr} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{it.tr}</div>
                  <div className="text-sm text-ink-2">{it.kz}</div>
                </div>
                <span className={`h-2 w-2 shrink-0 rounded-full ${mark(it.wordId)}`} title="Меңгеру деңгейі" />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-12">
        <h2 className="font-serif text-xl">Тараудың толық сөздігі</h2>
        <ul className="mt-4 divide-y divide-[var(--line)] rounded-[14px] border hairline bg-surface">
          {words.map((w) => (
            <li key={w.id} className="flex items-center gap-3 px-4 py-2.5">
              <SpeakButton text={w.tr} />
              <span className="w-1/2 font-medium">{w.tr}</span>
              <span className="flex-1 text-sm text-ink-2">{w.kz}</span>
              <Link href={`/kitap/${w.page}`} className="text-xs tabular-nums text-ink-3 hover:text-teal">
                {w.page}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-3">Дыбыс — браузердің түрік тіліндегі синтезі (TTS). Нүкте: сұр — жаңа, ашық — үйренуде, көк — меңгерілді.</p>
      </section>
    </PageShell>
  );
}
