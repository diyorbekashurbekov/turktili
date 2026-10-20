import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { review } from "@/lib/srs";

export const runtime = "nodejs";

const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page"), page: z.number().int().min(1).max(192), status: z.enum(["visited", "completed", "reset"]) }),
  z.object({ type: z.literal("bookmark"), page: z.number().int().min(1).max(192), on: z.boolean() }),
  z.object({ type: z.literal("note"), page: z.number().int().min(1).max(192), text: z.string().max(5000) }),
  z.object({ type: z.literal("vocab-review"), wordId: z.string().max(12), grade: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]) }),
  z.object({ type: z.literal("vocab-save"), wordId: z.string().max(12), saved: z.boolean() }),
  z.object({
    type: z.literal("attempts"),
    skill: z.enum(["okuma", "dinleme", "gramer", "kelime", "dikte", "yazma", "konusma"]),
    unit: z.number().int().min(0).max(9).nullable(),
    items: z.array(z.object({ itemId: z.string().max(40), correct: z.boolean(), given: z.string().max(300).optional() })).max(60),
  }),
  z.object({ type: z.literal("resolve"), ids: z.array(z.number().int()).max(200) }),
  z.object({ type: z.literal("prefs"), examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), name: z.string().max(60).optional() }),
]);

export async function POST(req: Request) {
  const user = await currentUser();
  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const a = parsed.data;
  switch (a.type) {
    case "page": {
      if (a.status === "reset") await q.run("DELETE FROM page_progress WHERE user_id = ? AND page = ?", user.id, a.page);
      else if (a.status === "completed")
        await q.run(
          "INSERT INTO page_progress (user_id, page, status) VALUES (?,?,'completed') ON CONFLICT(user_id, page) DO UPDATE SET status='completed', updated_at=datetime('now')",
          user.id,
          a.page,
        );
      else await q.run("INSERT OR IGNORE INTO page_progress (user_id, page, status) VALUES (?,?,'visited')", user.id, a.page);
      await q.run("UPDATE users SET last_page = ? WHERE id = ?", a.page, user.id);
      return Response.json({ ok: true });
    }
    case "bookmark":
      if (a.on) await q.run("INSERT OR IGNORE INTO bookmarks (user_id, page) VALUES (?,?)", user.id, a.page);
      else await q.run("DELETE FROM bookmarks WHERE user_id = ? AND page = ?", user.id, a.page);
      return Response.json({ ok: true });
    case "note": {
      const existing = await q.get<{ id: number }>("SELECT id FROM notes WHERE user_id = ? AND page = ?", user.id, a.page);
      if (!a.text.trim()) {
        if (existing) await q.run("DELETE FROM notes WHERE id = ?", existing.id);
      } else if (existing) await q.run("UPDATE notes SET text = ?, updated_at = datetime('now') WHERE id = ?", a.text, existing.id);
      else await q.run("INSERT INTO notes (user_id, page, text) VALUES (?,?,?)", user.id, a.page, a.text);
      return Response.json({ ok: true });
    }
    case "vocab-review": {
      const s = await q.get<{ reps: number; lapses: number; ease: number; interval_days: number }>(
        "SELECT reps, lapses, ease, interval_days FROM vocab_state WHERE user_id = ? AND word_id = ?",
        user.id,
        a.wordId,
      ) ?? { reps: 0, lapses: 0, ease: 2.5, interval_days: 0 };
      const n = review(s, a.grade);
      await q.run(
        `INSERT INTO vocab_state (user_id, word_id, reps, lapses, ease, interval_days, due_at, last_seen)
         VALUES (?,?,?,?,?,?,?,datetime('now'))
         ON CONFLICT(user_id, word_id) DO UPDATE SET reps=excluded.reps, lapses=excluded.lapses, ease=excluded.ease,
           interval_days=excluded.interval_days, due_at=excluded.due_at, last_seen=excluded.last_seen`,
        user.id,
        a.wordId,
        n.reps,
        n.lapses,
        n.ease,
        n.interval_days,
        n.due_at,
      );
      return Response.json({ ok: true, state: n });
    }
    case "vocab-save":
      await q.run(
        `INSERT INTO vocab_state (user_id, word_id, saved, due_at) VALUES (?,?,?,datetime('now'))
         ON CONFLICT(user_id, word_id) DO UPDATE SET saved = excluded.saved`,
        user.id,
        a.wordId,
        a.saved ? 1 : 0,
      );
      return Response.json({ ok: true });
    case "attempts":
      for (const it of a.items)
        await q.run(
          "INSERT INTO attempts (user_id, skill, unit, item_id, correct, given) VALUES (?,?,?,?,?,?)",
          user.id,
          a.skill,
          a.unit,
          it.itemId,
          it.correct ? 1 : 0,
          it.given ?? null,
        );
      // a later correct answer resolves earlier mistakes on the same item
      for (const it of a.items.filter((x) => x.correct))
        await q.run("UPDATE attempts SET resolved = 1 WHERE user_id = ? AND item_id = ? AND correct = 0", user.id, it.itemId);
      return Response.json({ ok: true });
    case "resolve":
      for (const id of a.ids) await q.run("UPDATE attempts SET resolved = 1 WHERE id = ? AND user_id = ?", id, user.id);
      return Response.json({ ok: true });
    case "prefs":
      if (a.examDate !== undefined) await q.run("UPDATE users SET exam_date = ? WHERE id = ?", a.examDate, user.id);
      if (a.name !== undefined) await q.run("UPDATE users SET name = ? WHERE id = ?", a.name, user.id);
      return Response.json({ ok: true });
  }
}
