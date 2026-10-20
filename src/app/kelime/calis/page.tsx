import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { buildSession } from "@/lib/vocab-session";
import { VocabSession } from "@/components/vocab-session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Сөз жаттығуы" };

const MODES = ["flash", "tr-kz", "kz-tr", "listen", "spell", "match"] as const;

export default async function Study({ searchParams }: { searchParams: Promise<{ set?: string; mode?: string }> }) {
  const sp = await searchParams;
  const set = sp.set && /^(due|saved|unit:[1-8]|page:\d{1,3})$/.test(sp.set) ? sp.set : "due";
  const mode = (MODES as readonly string[]).includes(sp.mode ?? "") ? (sp.mode as (typeof MODES)[number]) : "flash";
  const user = await currentUser();
  const words = await buildSession(user.id, set, mode === "match" ? 6 : 12);
  const back = set.startsWith("unit:") ? `/kelime/${set.slice(5)}` : "/kelime";
  return <VocabSession words={words} mode={mode} back={back} set={set} />;
}
