import "server-only";
import pagesJson from "./generated/pages.json";
import unitsJson from "./generated/units.json";
import vocabJson from "./generated/vocab.json";
import kelimeJson from "./generated/kelime.json";
import coverageJson from "./generated/coverage.json";
import type { BookPage, KelimeSet, PageLite, Unit, Word } from "./types";
import { q } from "@/lib/db";

const PAGES = pagesJson as BookPage[];
export const UNITS = unitsJson as Unit[];
const VOCAB = vocabJson as Word[];
export const KELIME = kelimeJson as KelimeSet[];
export const COVERAGE = coverageJson;
export const TOTAL_PAGES = 192;

/** Lesson units (1–8); 0 is front matter and 9 the appendix. */
export const LESSON_UNITS = UNITS.filter((u) => u.id >= 1 && u.id <= 8);

function applyOverrides(p: BookPage): BookPage {
  const rows = q.all<{ field: string; value: string }>("SELECT field, value FROM content_overrides WHERE page = ?", p.n);
  if (!rows.length) return p;
  const copy: BookPage = { ...p, blocks: [...p.blocks] };
  for (const r of rows) {
    if (r.field === "title") copy.title = r.value;
    if (r.field === "summary") {
      copy.summary = r.value;
      copy.blocks = copy.blocks.map((b) => (b.kind === "summary" ? { ...b, text: r.value } : b));
    }
    if (r.field.startsWith("block:")) {
      const i = Number(r.field.slice(6));
      if (copy.blocks[i]) copy.blocks[i] = { ...copy.blocks[i], text: r.value };
    }
  }
  return copy;
}

export function getPage(n: number): BookPage | null {
  const p = PAGES.find((x) => x.n === n);
  if (!p) return null;
  // multi-page sections store their content on the first page
  if (p.range && p.range[0] !== n) {
    const first = PAGES.find((x) => x.n === p.range![0])!;
    return applyOverrides({ ...first, n, range: p.range });
  }
  return applyOverrides(p);
}

export function pageList(): PageLite[] {
  return PAGES.map((p) => ({
    n: p.n,
    title: p.title,
    unit: p.unit,
    section: p.section,
    kind: p.kind,
    skills: p.skills,
    range: p.range,
    hasKelime: !!p.kelimeDunyasi,
  }));
}

export function unitOfPage(n: number) {
  return UNITS.find((u) => n >= u.from && n <= u.to)!;
}

let vocabCache: { at: number; words: Word[] } | null = null;
export function vocab(): Word[] {
  if (vocabCache && Date.now() - vocabCache.at < 10_000) return vocabCache.words;
  const ov = q.all<{ word_id: string; tr: string; kz: string }>("SELECT word_id, tr, kz FROM vocab_overrides");
  const map = new Map(ov.map((o) => [o.word_id, o]));
  const words = VOCAB.map((w) => (map.has(w.id) ? { ...w, tr: map.get(w.id)!.tr, kz: map.get(w.id)!.kz } : w));
  vocabCache = { at: Date.now(), words };
  return words;
}

export function invalidateVocab() {
  vocabCache = null;
}

export function wordsForPage(n: number) {
  return vocab().filter((w) => w.pages.includes(n) && w.source !== "index");
}

/** Kelime Dünyası words + every word introduced on lesson pages of the unit. */
export function wordsForUnit(unit: number, onlyKelime = false) {
  const words = vocab();
  const kelimeIds = new Set(KELIME.filter((k) => k.unit === unit).flatMap((k) => k.items.map((i) => i.wordId).filter(Boolean)));
  if (onlyKelime) return words.filter((w) => kelimeIds.has(w.id));
  return words.filter((w) => w.unit === unit && w.source !== "index");
}

export function kelimeWordIds(): Set<string> {
  return new Set(KELIME.flatMap((k) => k.items.map((i) => i.wordId!).filter(Boolean)));
}

/** Plain-text digest of a page for AI grounding (bounded length). */
export function pageDigest(n: number, maxChars = 6000) {
  const p = getPage(n);
  if (!p) return "";
  const u = unitOfPage(n);
  const parts = [
    `PAGE ${n} — "${p.title}" — Ünite ${u.id} ${u.tr} (${u.kz})${p.section ? `, bölüm ${p.section.code}. ${p.section.title}` : ""}`,
    ...p.blocks.map((b) => `## ${b.label || "Мазмұн"}\n${b.text}`),
  ];
  const text = parts.join("\n\n");
  return text.length > maxChars ? text.slice(0, maxChars) + "\n[…қысқартылды]" : text;
}

/** Very small keyword retrieval over page digests for grounding off-page questions. */
export function searchPages(query: string, limit = 2, exclude?: number) {
  const terms = query
    .toLocaleLowerCase("tr")
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((t) => t.length >= 3);
  if (!terms.length) return [];
  const scored = PAGES.filter((p) => p.blocks.length && p.n !== exclude && p.kind !== "blank")
    .map((p) => {
      const hay = (p.title + " " + p.blocks.map((b) => b.text).join(" ")).toLocaleLowerCase("tr");
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score += t.length > 5 ? 2 : 1;
      return { n: p.n, score };
    })
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.n);
}
