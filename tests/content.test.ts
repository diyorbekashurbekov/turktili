import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PRACTICE } from "../src/content/practice.ts";

const gen = (f: string) => JSON.parse(fs.readFileSync(new URL(`../src/content/generated/${f}`, import.meta.url), "utf8"));

test("all 192 textbook pages are present and processed", () => {
  const pages = gen("pages.json");
  assert.equal(pages.length, 192);
  const nums = new Set(pages.map((p: { n: number }) => p.n));
  for (let n = 1; n <= 192; n++) assert.ok(nums.has(n), `page ${n}`);
  const cov = gen("coverage.json");
  assert.equal(cov.missing.length, 0);
  assert.deepEqual(cov.blank, [8, 175]);
});

test("every Kelime Dünyası item has a Kazakh gloss", () => {
  const sets = gen("kelime.json");
  assert.ok(sets.length >= 20);
  for (const s of sets) for (const it of s.items) assert.ok(it.kz, `${s.page}: ${it.tr}`);
});

test("vocabulary entries are well formed", () => {
  const v = gen("vocab.json");
  assert.ok(v.length > 2000);
  const ids = new Set();
  for (const w of v) {
    assert.ok(w.tr && w.kz && w.page >= 1 && w.page <= 192, JSON.stringify(w));
    assert.ok(!ids.has(w.id));
    ids.add(w.id);
  }
});

test("assessment pages are the 8 Değerlendirme pages", () => {
  const pages = gen("pages.json");
  assert.deepEqual(pages.filter((p: { kind: string }) => p.kind === "assessment").map((p: { n: number }) => p.n), [31, 53, 75, 95, 115, 135, 153, 173]);
});

test("practice bank: 8 units, valid answer keys, unique ids", () => {
  assert.equal(PRACTICE.length, 8);
  const ids = new Set<string>();
  for (const p of PRACTICE) {
    const qs = [...p.reading.questions, ...p.listening.questions, ...p.grammar];
    assert.ok(p.reading.questions.length >= 5 && p.listening.questions.length >= 4 && p.grammar.length >= 8);
    assert.ok(p.listening.dictation.length >= 4 && p.writing.length >= 2 && p.speaking.questions.length >= 5);
    for (const q of qs) {
      assert.ok(!ids.has(q.id), `duplicate ${q.id}`);
      ids.add(q.id);
      if (q.type === "mcq") {
        assert.ok(q.answer >= 0 && q.answer < q.options.length, q.id);
        assert.equal(new Set(q.options).size, q.options.length, `duplicate option in ${q.id}`);
      }
      assert.ok(q.explain.length > 3, q.id);
      for (const pg of q.pages ?? []) assert.ok(pg >= 1 && pg <= 192);
    }
  }
});
