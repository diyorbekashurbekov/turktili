import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { aiConfigured } from "@/lib/ai";
import { EXAM_TYPES, type ExamPlan } from "@/lib/exam";
import { ExamRunner } from "@/components/exam-runner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Емтихан" };

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await currentUser();
  const row = await q.get<{ config: string; finished_at: string | null; started_at: string }>("SELECT config, finished_at, started_at FROM exams WHERE id = ? AND user_id = ?", id, user.id);
  if (!row) notFound();
  if (row.finished_at) redirect(`/sinav/${id}/sonuc`);
  const plan = JSON.parse(row.config) as ExamPlan;
  // the answer key never leaves the server
  const { key: _key, ...clientPlan } = plan;
  void _key;
  return (
    <ExamRunner
      id={id}
      plan={clientPlan}
      title={EXAM_TYPES[plan.type].kz + (plan.unit ? ` · ${plan.unit}-тарау` : "")}
      startedAt={row.started_at.replace(" ", "T") + "Z"}
      aiReady={aiConfigured()}
    />
  );
}
