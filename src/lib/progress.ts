import "server-only";
import { q } from "./db";
import { LESSON_UNITS, kelimeWordIds, vocab } from "@/content";
import type { UnitStatus } from "./plan";

export function pageStatuses(userId: string) {
  const rows = q.all<{ page: number; status: string }>("SELECT page, status FROM page_progress WHERE user_id = ?", userId);
  return Object.fromEntries(rows.map((r) => [r.page, r.status])) as Record<number, string>;
}

export function skillAccuracy(userId: string) {
  const rows = q.all<{ skill: string; unit: number | null; c: number; ok: number }>(
    "SELECT skill, unit, COUNT(*) AS c, SUM(correct) AS ok FROM attempts WHERE user_id = ? GROUP BY skill, unit",
    userId,
  );
  return rows;
}

export function unitStatuses(userId: string): UnitStatus[] {
  const pages = pageStatuses(userId);
  const acc = skillAccuracy(userId);
  return LESSON_UNITS.map((u) => {
    let done = 0;
    for (let n = u.from; n <= u.to; n++) if (pages[n] === "completed") done++;
    const a = acc.filter((r) => r.unit === u.id);
    const c = a.reduce((s, r) => s + r.c, 0);
    const ok = a.reduce((s, r) => s + r.ok, 0);
    return { unit: u.id, pagesDone: done, pagesTotal: u.to - u.from + 1, accuracy: c >= 4 ? ok / c : null, from: u.from, to: u.to };
  });
}

export function overview(userId: string) {
  const pages = pageStatuses(userId);
  const completed = Object.values(pages).filter((s) => s === "completed").length;
  const visited = Object.keys(pages).length;
  const kelime = kelimeWordIds();
  const states = q.all<{ word_id: string; interval_days: number; due_at: string | null }>(
    "SELECT word_id, interval_days, due_at FROM vocab_state WHERE user_id = ?",
    userId,
  );
  const mastered = states.filter((s) => s.interval_days >= 4).length;
  const now = new Date().toISOString();
  const due = states.filter((s) => s.due_at && s.due_at <= now).length;
  const bySkill = q.all<{ skill: string; c: number; ok: number }>(
    "SELECT skill, COUNT(*) AS c, SUM(correct) AS ok FROM attempts WHERE user_id = ? GROUP BY skill",
    userId,
  );
  const mistakes = q.get<{ c: number }>("SELECT COUNT(*) AS c FROM attempts WHERE user_id = ? AND correct = 0 AND resolved = 0", userId)?.c ?? 0;
  const writings = q.get<{ c: number }>("SELECT COUNT(*) AS c FROM writings WHERE user_id = ?", userId)?.c ?? 0;
  const speaking = q.get<{ c: number }>("SELECT COUNT(*) AS c FROM speaking_sessions WHERE user_id = ?", userId)?.c ?? 0;
  const exams = q.all<{ id: number; type: string; result: string | null; finished_at: string | null }>(
    "SELECT id, type, result, finished_at FROM exams WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 10",
    userId,
  );
  return {
    pagesCompleted: completed,
    pagesVisited: visited,
    kelimeTotal: kelime.size,
    wordsSeen: states.length,
    wordsMastered: mastered,
    wordsDue: due,
    bySkill,
    mistakes,
    writings,
    speaking,
    exams,
    units: unitStatuses(userId),
    totalWords: vocab().length,
  };
}
