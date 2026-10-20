import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageImagePath } from "@/lib/page-image";
import { currentUser } from "@/lib/auth";
import { getPage, pageList, unitOfPage, wordsForPage, KELIME } from "@/content";
import { practiceForUnit } from "@/content/practice";
import { pageStatuses } from "@/lib/progress";
import { aiConfigured } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import { q } from "@/lib/db";
import { BookReader } from "@/components/book-reader";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const n = Number((await params).page);
  const p = Number.isInteger(n) ? getPage(n) : null;
  return { title: p ? `${n}-бет · ${p.title}` : "Бет" };
}

export default async function ReaderPage({ params }: { params: Promise<{ page: string }> }) {
  const n = Number((await params).page);
  if (!Number.isInteger(n) || n < 1 || n > 192) notFound();
  const page = getPage(n)!;
  const user = await currentUser();
  const unit = unitOfPage(n);
  const settings = getSettings();
  const bookmarked = !!q.get("SELECT 1 FROM bookmarks WHERE user_id = ? AND page = ?", user.id, n);
  const note = q.get<{ text: string }>("SELECT text FROM notes WHERE user_id = ? AND page = ?", user.id, n)?.text ?? "";
  const audios = q.all<{ id: number; title: string }>("SELECT id, title FROM audio_assets WHERE page = ? ORDER BY id", n);
  const kelime = KELIME.find((k) => k.page === (page.range?.[0] ?? n)) ?? null;

  return (
    <BookReader
      page={page}
      unit={{ id: unit.id, tr: unit.tr, kz: unit.kz, from: unit.from, to: unit.to, sections: unit.sections }}
      pages={pageList()}
      statuses={pageStatuses(user.id)}
      bookmarked={bookmarked}
      note={note}
      words={wordsForPage(n).map((w) => ({ id: w.id, tr: w.tr, kz: w.kz }))}
      kelime={kelime?.items ?? null}
      hasImage={settings.pageImagesAuthorized && !!pageImagePath(n)}
      audios={audios}
      aiReady={aiConfigured()}
      hasPractice={!!practiceForUnit(unit.id)}
    />
  );
}
