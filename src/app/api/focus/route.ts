import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { addDays, buildPlan, daysBetween } from "@/lib/plan";
import { unitStatuses } from "@/lib/progress";

export const runtime = "nodejs";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), today: date, mode: z.enum(["7", "14", "21", "custom"]), examDate: date.optional() }),
  z.object({ action: z.literal("toggle"), taskId: z.number().int(), done: z.boolean() }),
  z.object({ action: z.literal("recalc"), today: date }),
  z.object({ action: z.literal("end") }),
]);

async function insertTasks(planId: number, tasks: ReturnType<typeof buildPlan>) {
  for (const t of tasks)
    await q.run("INSERT INTO focus_tasks (plan_id, day, position, kind, ref, title, minutes) VALUES (?,?,?,?,?,?,?)", planId, t.day, t.position, t.kind, t.ref, t.title, t.minutes);
}

export async function POST(req: Request) {
  const user = await currentUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Күнді дұрыс енгізіңіз." }, { status: 400 });
  const b = parsed.data;

  if (b.action === "create") {
    const examDate = b.mode === "custom" ? b.examDate : addDays(b.today, Number(b.mode));
    if (!examDate || daysBetween(b.today, examDate) < 1) return Response.json({ error: "Емтихан күні бүгіннен кейін болуы керек." }, { status: 400 });
    if (daysBetween(b.today, examDate) > 120) return Response.json({ error: "Жоспар 120 күннен аспауы керек." }, { status: 400 });
    await q.run("UPDATE focus_plans SET active = 0 WHERE user_id = ?", user.id);
    const planId = Number(
      (await q.run("INSERT INTO focus_plans (user_id, exam_date, start_date, mode) VALUES (?,?,?,?)", user.id, examDate, b.today, b.mode)).lastInsertRowid,
    );
    await insertTasks(planId, buildPlan(b.today, examDate, await unitStatuses(user.id)));
    await q.run("UPDATE users SET exam_date = ? WHERE id = ?", examDate, user.id);
    return Response.json({ ok: true });
  }

  const plan = await q.get<{ id: number; exam_date: string }>("SELECT id, exam_date FROM focus_plans WHERE user_id = ? AND active = 1 ORDER BY id DESC", user.id);
  if (!plan) return Response.json({ error: "Белсенді жоспар жоқ." }, { status: 404 });

  if (b.action === "toggle") {
    await q.run(
      "UPDATE focus_tasks SET done_at = ? WHERE id = ? AND plan_id = ?",
      b.done ? new Date().toISOString() : null,
      b.taskId,
      plan.id,
    );
    return Response.json({ ok: true });
  }
  if (b.action === "recalc") {
    // keep finished tasks as history; regenerate everything not yet done from today on
    await q.run("DELETE FROM focus_tasks WHERE plan_id = ? AND done_at IS NULL", plan.id);
    if (daysBetween(b.today, plan.exam_date) >= 1) await insertTasks(plan.id, buildPlan(b.today, plan.exam_date, await unitStatuses(user.id)));
    return Response.json({ ok: true });
  }
  await q.run("UPDATE focus_plans SET active = 0 WHERE id = ?", plan.id);
  return Response.json({ ok: true });
}
