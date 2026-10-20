import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { unitStatuses } from "@/lib/progress";
import { dueCount } from "@/lib/vocab-session";
import { FocusMode } from "@/components/focus-mode";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Odak Modu" };

export default async function Odak() {
  const user = await currentUser();
  const plan = q.get<{ id: number; exam_date: string; start_date: string; mode: string }>(
    "SELECT id, exam_date, start_date, mode FROM focus_plans WHERE user_id = ? AND active = 1 ORDER BY id DESC",
    user.id,
  );
  const tasks = plan
    ? q.all<{ id: number; day: string; position: number; kind: string; ref: string; title: string; minutes: number; done_at: string | null }>(
        "SELECT id, day, position, kind, ref, title, minutes, done_at FROM focus_tasks WHERE plan_id = ? ORDER BY day, position",
        plan.id,
      )
    : [];
  const mistakes = q.get<{ c: number }>("SELECT COUNT(*) AS c FROM attempts WHERE user_id = ? AND correct = 0 AND resolved = 0", user.id)?.c ?? 0;
  return <FocusMode plan={plan ?? null} tasks={tasks} units={unitStatuses(user.id)} due={dueCount(user.id)} mistakes={mistakes} />;
}
