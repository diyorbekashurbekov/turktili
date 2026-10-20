import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Bookmark, RefreshCw } from "lucide-react";
import { currentUser, isGuest } from "@/lib/auth";
import { LESSON_UNITS, KELIME } from "@/content";
import { dueCount, savedWords, unitVocabStats } from "@/lib/vocab-session";
import { PageShell } from "@/components/shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kelime Dünyası" };

export default async function KelimeHub() {
  const user = await currentUser();
  const due = dueCount(user.id);
  const stats = unitVocabStats(user.id);
  const saved = savedWords(user.id);
  const totalKelime = KELIME.reduce((s, k) => s + k.items.length, 0);

  return (
    <PageShell userLabel={isGuest(user) ? "Қонақ" : (user.name ?? "")}>
      <div className="eyebrow">Kelime Dünyası</div>
      <h1 className="mt-2 font-serif text-4xl sm:text-5xl" style={{ fontWeight: 460 }}>
        Сөздер әлемі
      </h1>
      <p className="mt-3 max-w-xl text-ink-2">
        Кітаптағы {KELIME.length} «Kelime Dünyası» бөлімінің {totalKelime} сөзі және әр тараудың сөздігі — қазақша аудармасымен, айтылуымен және аралықты қайталау (spaced repetition) жүйесімен.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href={due ? "/kelime/calis?set=due&mode=flash" : "/kelime/1"} className="card group flex items-center gap-5 p-6 transition-colors hover:border-teal">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-teal-soft text-teal">
            <RefreshCw size={20} />
          </div>
          <div className="flex-1">
            <div className="font-serif text-xl">{due ? `Бүгін қайталау: ${due} сөз` : "Қайталайтын сөз жоқ"}</div>
            <div className="text-sm text-ink-2">{due ? "Ұмытылуға жақын сөздер" : "Жаңа тараудан бастаңыз"}</div>
          </div>
          <ArrowRight size={18} className="text-ink-3 transition-transform group-hover:translate-x-1" />
        </Link>
        <Link href={saved.length ? "/kelime/calis?set=saved&mode=flash" : "#saved"} className="card group flex items-center gap-5 p-6 transition-colors hover:border-teal">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-2">
            <Bookmark size={20} />
          </div>
          <div className="flex-1">
            <div className="font-serif text-xl">Қиын сөздерім · {saved.length}</div>
            <div className="text-sm text-ink-2">Сақталған сөздер</div>
          </div>
          <ArrowRight size={18} className="text-ink-3 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <h2 className="eyebrow mt-14">Тараулар бойынша</h2>
      <ul className="mt-4 divide-y divide-[var(--line)] border-y hairline">
        {LESSON_UNITS.map((u) => {
          const s = stats.find((x) => x.unit === u.id)!;
          return (
            <li key={u.id}>
              <Link href={`/kelime/${u.id}`} className="group flex items-center gap-5 py-5">
                <span className="w-6 font-serif text-2xl text-ink-3 group-hover:text-teal">{u.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-serif text-xl">{u.tr}</span>
                  <span className="ml-2 text-sm text-ink-3">{u.kz}</span>
                  <span className="mt-2 block max-w-xs">
                    <span className="progress-track block">
                      <span className="progress-fill block" style={{ width: `${s.total ? (s.mastered / s.total) * 100 : 0}%` }} />
                    </span>
                  </span>
                </span>
                <span className="text-right text-xs leading-relaxed text-ink-3">
                  <span className="block">{s.kelime} Kelime Dünyası</span>
                  <span className="block">
                    {s.mastered}/{s.total} меңгерілді
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {saved.length > 0 && (
        <section id="saved" className="mt-14">
          <h2 className="eyebrow">Сақталған сөздер</h2>
          <div className="mt-4 grid gap-px overflow-hidden rounded-[14px] border hairline bg-line sm:grid-cols-2">
            {saved.map((w) => (
              <div key={w.id} className="bg-surface px-4 py-3">
                <div className="font-medium">{w.tr}</div>
                <div className="text-sm text-ink-2">{w.kz}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
