import "server-only";
import { KELIME, vocab, wordsForUnit } from "@/content";
import type { Word } from "@/content/types";
import { q } from "./db";

export type SessionWord = { id: string; tr: string; kz: string; page: number; options?: { tr: string; kz: string }[] };

type State = { word_id: string; due_at: string | null; interval_days: number; saved: number; reps: number };

function states(userId: string) {
  return new Map(q.all<State>("SELECT word_id, due_at, interval_days, saved, reps FROM vocab_state WHERE user_id = ?", userId).map((s) => [s.word_id, s]));
}

const usable = (w: Word) => w.tr.length <= 40 && w.kz.length <= 70 && !/^\d/.test(w.tr);

function shuffle<T>(a: T[], seed = Date.now()) {
  const r = [...a];
  let s = seed % 2147483647;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Picks words for a study session: due first, then new Kelime Dünyası words, then other unit words. */
export function buildSession(userId: string, set: string, size = 12): SessionWord[] {
  const st = states(userId);
  const now = new Date().toISOString();
  const all = vocab().filter(usable);
  let pool: Word[];
  if (set === "due") pool = all.filter((w) => (st.get(w.id)?.due_at ?? "9") <= now && (st.get(w.id)?.reps ?? 0) > 0);
  else if (set === "saved") pool = all.filter((w) => st.get(w.id)?.saved);
  else if (set.startsWith("unit:")) {
    const unit = Number(set.slice(5));
    const kelime = wordsForUnit(unit, true).filter(usable);
    const rest = wordsForUnit(unit).filter(usable).filter((w) => !kelime.includes(w));
    const rank = (w: Word) => {
      const s = st.get(w.id);
      if (s?.due_at && s.due_at <= now) return 0; // due
      if (!s || !s.reps) return 1; // new
      return 2; // learned, not due
    };
    pool = [...kelime, ...rest].sort((a, b) => rank(a) - rank(b));
    pool = [...pool.filter((w) => rank(w) < 2), ...pool.filter((w) => rank(w) === 2)];
  } else if (set.startsWith("page:")) {
    const page = Number(set.slice(5));
    const ids = new Set(KELIME.find((k) => k.page === page)?.items.map((i) => i.wordId) ?? []);
    pool = all.filter((w) => ids.has(w.id) || w.pages.includes(page));
  } else pool = [];

  const picked = set.startsWith("unit:") ? pool.slice(0, size) : shuffle(pool).slice(0, size);
  const distractorPool = set.startsWith("unit:") ? wordsForUnit(Number(set.slice(5))).filter(usable) : all;
  return shuffle(picked).map((w, i) => {
    const others = shuffle(distractorPool.filter((d) => d.id !== w.id && d.kz !== w.kz && d.tr !== w.tr), i + 7).slice(0, 3);
    const options = shuffle([w, ...others], i + 3).map((o) => ({ tr: o.tr, kz: o.kz }));
    return { id: w.id, tr: w.tr, kz: w.kz, page: w.page, options };
  });
}

export function unitVocabStats(userId: string) {
  const st = states(userId);
  return [1, 2, 3, 4, 5, 6, 7, 8].map((u) => {
    const kelime = wordsForUnit(u, true);
    const words = wordsForUnit(u);
    const ids = new Set([...kelime, ...words].map((w) => w.id));
    let seen = 0;
    let mastered = 0;
    for (const id of ids) {
      const s = st.get(id);
      if (s?.reps) seen++;
      if (s && s.interval_days >= 4) mastered++;
    }
    return { unit: u, kelime: kelime.length, total: ids.size, seen, mastered };
  });
}

export function dueCount(userId: string) {
  return q.get<{ c: number }>("SELECT COUNT(*) AS c FROM vocab_state WHERE user_id = ? AND reps > 0 AND due_at <= ?", userId, new Date().toISOString())?.c ?? 0;
}

export function savedWords(userId: string) {
  const ids = new Set(q.all<{ word_id: string }>("SELECT word_id FROM vocab_state WHERE user_id = ? AND saved = 1", userId).map((r) => r.word_id));
  return vocab().filter((w) => ids.has(w.id));
}
