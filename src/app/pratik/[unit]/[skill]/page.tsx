import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { currentUser, isGuest } from "@/lib/auth";
import { UNITS } from "@/content";
import { practiceForUnit } from "@/content/practice";
import { aiConfigured } from "@/lib/ai";
import { q } from "@/lib/db";
import { PageShell } from "@/components/shell";
import { PracticeView } from "@/components/practice-view";

export const dynamic = "force-dynamic";

const SKILLS = {
  okuma: { tr: "Okuma", kz: "Оқу" },
  dinleme: { tr: "Dinleme", kz: "Тыңдау" },
  gramer: { tr: "Dil Bilgisi", kz: "Грамматика" },
  yazma: { tr: "Yazma", kz: "Жазу" },
  konusma: { tr: "Konuşma", kz: "Сөйлеу" },
} as const;
type SkillKey = keyof typeof SKILLS;

export async function generateMetadata({ params }: { params: Promise<{ unit: string; skill: string }> }): Promise<Metadata> {
  const { unit, skill } = await params;
  return { title: `${unit}-тарау · ${SKILLS[skill as SkillKey]?.kz ?? ""}` };
}

export default async function Practice({ params }: { params: Promise<{ unit: string; skill: string }> }) {
  const { unit: u, skill } = await params;
  const unitId = Number(u);
  const practice = practiceForUnit(unitId);
  if (!practice || !(skill in SKILLS)) notFound();
  const unit = UNITS.find((x) => x.id === unitId)!;
  const user = await currentUser();
  const history =
    skill === "yazma"
      ? await q.all<{ id: number; prompt_id: string; text: string; feedback: string | null; created_at: string }>(
          "SELECT id, prompt_id, text, feedback, created_at FROM writings WHERE user_id = ? AND prompt_id LIKE ? ORDER BY id DESC LIMIT 6",
          user.id,
          `u${unitId}w%`,
        )
      : [];

  return (
    <PageShell userLabel={isGuest(user) ? "Қонақ" : (user.name ?? "")}>
      <Link href={`/kitap/${unit.from}`} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> {unit.id}. {unit.tr}
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">
            Ünite {unit.id} · {unit.tr}
          </div>
          <h1 className="mt-2 font-serif text-4xl">{SKILLS[skill as SkillKey].tr}</h1>
          <p className="mt-1 text-ink-2">{SKILLS[skill as SkillKey].kz}</p>
        </div>
      </div>
      <nav className="no-scrollbar mt-8 flex gap-1 overflow-x-auto border-b hairline" aria-label="Дағдылар">
        {(Object.keys(SKILLS) as SkillKey[]).map((k) => (
          <Link
            key={k}
            href={`/pratik/${unitId}/${k}`}
            className={`-mb-px shrink-0 border-b-2 px-3 pb-3 text-sm transition-colors ${k === skill ? "border-teal text-ink" : "border-transparent text-ink-3 hover:text-ink-2"}`}
            aria-current={k === skill ? "page" : undefined}
          >
            {SKILLS[k].kz}
          </Link>
        ))}
        <Link href={`/kelime/${unitId}`} className="-mb-px shrink-0 border-b-2 border-transparent px-3 pb-3 text-sm text-ink-3 hover:text-ink-2">
          Kelime Dünyası
        </Link>
      </nav>
      <div className="mt-8">
        <PracticeView skill={skill as SkillKey} practice={practice} aiReady={aiConfigured()} history={history} />
      </div>
      <p className="mt-10 text-xs text-ink-3">
        Бұл жаттығуларды платформа {unit.id}-тараудың тақырыбы мен грамматикасы негізінде жасаған — кітаптың түпнұсқа мәтіні емес.
      </p>
    </PageShell>
  );
}
