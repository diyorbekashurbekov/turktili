import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { composeExam, gradeExam, type ExamPlan } from "@/lib/exam";

export const runtime = "nodejs";

const Start = z.object({
  action: z.literal("start"),
  type: z.enum(["okuma", "dinleme", "yazma", "konusma", "kelime", "gramer", "unite", "full"]),
  unit: z.number().int().min(1).max(8).nullable().optional(),
});
const Submit = z.object({
  action: z.literal("submit"),
  id: z.number().int(),
  answers: z.record(z.string(), z.union([z.number(), z.boolean()])),
  writing: z.object({ text: z.string().max(4000), feedback: z.unknown().nullable() }).nullable().optional(),
  speaking: z.object({ sessionId: z.number().int().nullable(), feedback: z.unknown().nullable() }).nullable().optional(),
});

export async function POST(req: Request) {
  const user = await currentUser();
  const body = await req.json().catch(() => null);
  const s = Start.safeParse(body);
  if (s.success) {
    const plan = composeExam(s.data.type, s.data.unit ?? null, getSettings().exam);
    const id = Number(q.run("INSERT INTO exams (user_id, type, config) VALUES (?,?,?)", user.id, s.data.type, JSON.stringify(plan)).lastInsertRowid);
    return Response.json({ id });
  }
  const sub = Submit.safeParse(body);
  if (!sub.success) return Response.json({ error: "bad request" }, { status: 400 });
  const row = q.get<{ config: string; finished_at: string | null }>("SELECT config, finished_at FROM exams WHERE id = ? AND user_id = ?", sub.data.id, user.id);
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  if (row.finished_at) return Response.json({ ok: true, id: sub.data.id });
  const plan = JSON.parse(row.config) as ExamPlan;
  const w = sub.data.writing ? { text: sub.data.writing.text, feedback: sub.data.writing.feedback ?? null } : null;
  const sp = sub.data.speaking ? { sessionId: sub.data.speaking.sessionId, feedback: sub.data.speaking.feedback ?? null } : null;
  const result = gradeExam(plan, sub.data.answers, w, sp);
  q.run("UPDATE exams SET answers = ?, result = ?, finished_at = datetime('now') WHERE id = ?", JSON.stringify(sub.data.answers), JSON.stringify(result), sub.data.id);
  for (const it of result.items)
    q.run(
      "INSERT INTO attempts (user_id, skill, unit, item_id, correct, given) VALUES (?,?,?,?,?,?)",
      user.id,
      it.skill,
      it.unit,
      it.id,
      it.correct ? 1 : 0,
      it.given === null ? null : it.options && typeof it.given === "number" ? (it.options[it.given] ?? null) : String(it.given),
    );
  return Response.json({ ok: true, id: sub.data.id });
}
