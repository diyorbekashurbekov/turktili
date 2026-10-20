import { vocab } from "@/content";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";

/** Word lookup for the instant-explanation popover (exact → stem prefix match). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("q") || "").trim();
  if (!raw || raw.length > 60) return Response.json({ matches: [] });
  const term = raw.toLocaleLowerCase("tr").replace(/[.,!?;:«»"“”()]/g, "");
  const words = await vocab();
  const clean = (s: string) => s.toLocaleLowerCase("tr").replace(/\s*\([^)]*\)/g, "").replace(/[!?.]+$/, "").trim();
  let matches = words.filter((w) => clean(w.tr) === term || clean(w.tr).split(" / ").includes(term));
  if (!matches.length && term.length >= 4) {
    // strip common A1 suffixes progressively to find a base form (kitabı → kitap via base list)
    for (let cut = 1; cut <= Math.min(6, term.length - 3) && !matches.length; cut++) {
      const stem = term.slice(0, term.length - cut);
      matches = words.filter((w) => {
        const c = clean(w.tr);
        return c === stem || (c.length >= 3 && c.startsWith(stem) && c.length - stem.length <= 2) || c.replace(/(mek|mak)$/, "") === stem;
      });
    }
  }
  const user = await currentUser();
  const saved = new Set(
    (await q.all<{ word_id: string }>("SELECT word_id FROM vocab_state WHERE user_id = ? AND saved = 1", user.id)).map((r) => r.word_id),
  );
  return Response.json({
    matches: matches.slice(0, 3).map((w) => ({ id: w.id, tr: w.tr, kz: w.kz, page: w.page, source: w.source, saved: saved.has(w.id) })),
  });
}
