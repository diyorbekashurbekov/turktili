import { test } from "node:test";
import assert from "node:assert/strict";
import { review, isMastered } from "../src/lib/srs.ts";

const fresh = { reps: 0, lapses: 0, ease: 2.5, interval_days: 0 };

test("good answers grow the interval", () => {
  const a = review(fresh, 2);
  const b = review(a, 2);
  const c = review(b, 2);
  assert.equal(a.interval_days, 1);
  assert.equal(b.interval_days, 4);
  assert.ok(c.interval_days > b.interval_days);
  assert.ok(isMastered(b));
});

test("again resets and lowers ease", () => {
  const a = review(review(fresh, 2), 2);
  const r = review(a, 0);
  assert.equal(r.reps, 0);
  assert.equal(r.interval_days, 0);
  assert.equal(r.lapses, 1);
  assert.ok(r.ease < a.ease);
  assert.ok(new Date(r.due_at).getTime() - Date.now() < 11 * 60_000);
});

test("ease stays within bounds", () => {
  let s = { ...fresh, due_at: "" };
  for (let i = 0; i < 20; i++) s = review(s, 0);
  assert.ok(s.ease >= 1.3);
  for (let i = 0; i < 20; i++) s = review(s, 3);
  assert.ok(s.ease <= 3);
});
