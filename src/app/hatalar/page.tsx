import Link from "next/link";
import type { Metadata } from "next";
import { currentUser, isGuest } from "@/lib/auth";
import { q } from "@/lib/db";
import { PRACTICE } from "@/content/practice";
import { vocab } from "@/content";
import { PageShell } from "@/components/shell";
import { ResolveButton } from "@/components/resolve-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Қателерім" };

const SKILL_KZ: Record<string, string> = { okuma: "Оқу", dinleme: "Тыңдау", gramer: "Грамматика", kelime: "Сөздік", dikte: "Диктант" };

export default async function Mistakes() {
  const user = await currentUser();
  const rows = q.all<{ id: number; skill: string; unit: number | null; item_id: string; given: string | null; created_at: string }>(
    "SELECT id, skill, unit, item_id, given, created_at FROM attempts WHERE user_id = ? AND correct = 0 AND resolved = 0 ORDER BY id DESC LIMIT 80",
    user.id,
  );
  const questions = new Map(PRACTICE.flatMap((p) => [...p.reading.questions, ...p.listening.questions, ...p.grammar].map((qq) => [qq.id, { qq, unit: p.unit }] as const)));
  const dict = new Map<string, string>(PRACTICE.flatMap((p) => p.listening.dictation.map((s, i) => [`u${p.unit}d${i}`, s] as const)));
  const words = new Map(vocab().map((w) => [w.id, w]));
  // one card per item (latest attempt)
  const seen = new Set<string>();
  const items = rows.filter((r) => (seen.has(r.item_id) ? false : (seen.add(r.item_id), true)));

  return (
    <PageShell userLabel={isGuest(user) ? "Қонақ" : (user.name ?? "")}>
      <div className="eyebrow">Hatalarım</div>
      <h1 className="mt-2 font-serif text-4xl">Қателерді қайталау</h1>
      <p className="mt-3 max-w-xl text-ink-2">Жаттығу мен емтихандағы түзетілмеген қателер. Сол сұраққа кейін дұрыс жауап берсеңіз, ол автоматты түрде жабылады.</p>
      {items.length > 0 && (
        <Link href="/ogretmen?mode=mistakes" className="btn btn-teal mt-6">
          AI мұғаліммен талдау
        </Link>
      )}
      {items.length === 0 ? (
        <div className="mt-12 rounded-[14px] border hairline p-10 text-center text-ink-2">Түзетілмеген қате жоқ.</div>
      ) : (
        <ul className="mt-10 space-y-3">
          {items.map((r) => {
            const qx = questions.get(r.item_id);
            const wordId = r.item_id.startsWith("v:") ? r.item_id.split(":")[1] : r.item_id;
            const w = words.get(wordId);
            const unit = qx?.unit ?? r.unit;
            return (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  <span className="chip">{SKILL_KZ[r.skill] ?? r.skill}</span>
                  {unit ? <span>{unit}-тарау</span> : null}
                  <span className="ml-auto">{r.created_at.slice(0, 10)}</span>
                </div>
                {qx ? (
                  <>
                    <div className="mt-3 font-medium">{qx.qq.prompt}</div>
                    <div className="mt-2 text-sm">
                      <span className="text-ink-3">Сіз: </span>
                      <span className="text-rose">{r.given ?? "—"}</span>
                      <span className="ml-3 text-ink-3">Дұрысы: </span>
                      <span className="text-green">{qx.qq.type === "mcq" ? qx.qq.options[qx.qq.answer] : qx.qq.answer ? "Doğru" : "Yanlış"}</span>
                    </div>
                    <p className="mt-2 text-sm text-ink-2">{qx.qq.explain}</p>
                  </>
                ) : dict.has(r.item_id) ? (
                  <>
                    <div className="mt-3 font-medium">Диктант: {dict.get(r.item_id)}</div>
                    <div className="mt-1 text-sm text-rose">Сіз: {r.given}</div>
                  </>
                ) : w ? (
                  <div className="mt-3">
                    <span className="font-medium">{w.tr}</span> <span className="text-ink-2">— {w.kz}</span>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-ink-2">{r.item_id}</div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {qx?.qq.pages?.map((p) => (
                    <Link key={p} href={`/kitap/${p}`} className="btn btn-ghost h-8 px-3 text-xs">
                      {p}-бет
                    </Link>
                  ))}
                  {unit && unit >= 1 && unit <= 8 && (
                    <Link href={w ? `/kelime/${unit}` : `/pratik/${unit}/${r.skill === "dikte" ? "dinleme" : r.skill}`} className="btn btn-ghost h-8 px-3 text-xs">
                      Қайта жаттығу
                    </Link>
                  )}
                  <ResolveButton ids={rows.filter((x) => x.item_id === r.item_id).map((x) => x.id)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
