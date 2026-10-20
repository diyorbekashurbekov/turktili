import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, daysBetween, addDays, prioritize, type UnitStatus } from "../src/lib/plan.ts";

const units = (over: Partial<UnitStatus>[] = []): UnitStatus[] =>
  [1, 2, 3, 4, 5, 6, 7, 8].map((u, i) => ({ unit: u, pagesDone: 0, pagesTotal: 20, accuracy: null, from: u * 20, to: u * 20 + 19, ...(over[i] ?? {}) }));

for (const days of [7, 14, 21]) {
  test(`${days}-day plan covers every unit and ends with a full mock exam`, () => {
    const start = "2026-10-20";
    const exam = addDays(start, days);
    const tasks = buildPlan(start, exam, units());
    const covered = new Set(tasks.filter((t) => t.kind === "pages").map((t) => t.ref));
    assert.equal(covered.size, 8);
    assert.ok(tasks.every((t) => t.day >= start && t.day < exam), "no task on or after exam day");
    const last = tasks.filter((t) => t.day === addDays(exam, -1));
    assert.ok(last.some((t) => t.kind === "exam" && t.ref === "full"));
    for (const k of ["okuma", "dinleme", "gramer", "vocab"]) assert.ok(tasks.some((t) => t.kind === k), k);
    assert.ok(tasks.some((t) => t.kind === "yazma") && tasks.some((t) => t.kind === "konusma"));
  });
}

test("one-day plan still produces tasks", () => {
  const tasks = buildPlan("2026-10-20", "2026-10-21", units());
  assert.ok(tasks.length > 0);
  assert.ok(tasks.every((t) => t.day === "2026-10-20"));
});

test("strong units get a light review instead of a full block", () => {
  const strong = units([{ pagesDone: 20, accuracy: 0.95 }]);
  const tasks = buildPlan("2026-10-20", "2026-11-03", strong);
  assert.ok(!tasks.some((t) => t.kind === "pages" && t.ref === "20-39"));
  assert.ok(tasks.some((t) => t.kind === "gramer" && t.ref === "1"));
});

test("weak units are scheduled first", () => {
  const u = units([{ pagesDone: 20, accuracy: 0.9 }, { pagesDone: 20, accuracy: 0.9 }]);
  assert.equal(prioritize(u)[0].unit, 3);
});

test("date helpers", () => {
  assert.equal(daysBetween("2026-10-30", "2026-11-02"), 3);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
