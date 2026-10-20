import "server-only";
import { PRACTICE, type Question, type DialogueLine } from "@/content/practice";
import { wordsForUnit } from "@/content";
import type { ExamConfig } from "./settings";

export type ExamType = "okuma" | "dinleme" | "yazma" | "konusma" | "kelime" | "gramer" | "unite" | "full";

export const EXAM_TYPES: Record<ExamType, { tr: string; kz: string; desc: string }> = {
  okuma: { tr: "Okuma", kz: "Оқу", desc: "Мәтіндер және түсіну сұрақтары" },
  dinleme: { tr: "Dinleme", kz: "Тыңдау", desc: "Диалогтар (TTS) және сұрақтар" },
  yazma: { tr: "Yazma", kz: "Жазу", desc: "Шағын мәтін, AI бағалауы" },
  konusma: { tr: "Konuşma", kz: "Сөйлеу", desc: "AI емтихан алушымен ауызша сұхбат" },
  kelime: { tr: "Kelime", kz: "Сөздік", desc: "Kelime Dünyası сөздері" },
  gramer: { tr: "Dil Bilgisi", kz: "Грамматика", desc: "8 тараудың грамматикасы" },
  unite: { tr: "Ünite Testi", kz: "Тарау тесті", desc: "Бір тарау бойынша аралас тест" },
  full: { tr: "Deneme Sınavı", kz: "Толық сынақ", desc: "Төрт дағды бір емтиханда" },
};

export type ClientQuestion = { id: string; type: "mcq"; prompt: string; options: string[] } | { id: string; type: "tf"; prompt: string };
export type ExamSection =
  | { kind: "reading"; skill: "okuma"; title: string; text: string; questions: ClientQuestion[] }
  | { kind: "listening"; skill: "dinleme"; title: string; lines: DialogueLine[]; questions: ClientQuestion[] }
  | { kind: "mcq"; skill: "gramer" | "kelime"; title: string; questions: ClientQuestion[] }
  | { kind: "writing"; skill: "yazma"; task: { id: string; tr: string; kz: string; minSentences: number; focus: string; pages: number[] } }
  | { kind: "speaking"; skill: "konusma"; topic: { tr: string; kz: string }; questions: string[] };

export type KeyItem = { id: string; skill: string; unit: number; answer: number | boolean; explain: string; pages: number[]; prompt: string; options?: string[] };
export type ExamPlan = { type: ExamType; unit: number | null; minutes: number; sections: ExamSection[]; key: KeyItem[] };

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function shuffle<T>(a: T[], r: () => number) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}
const strip = (q: Question): ClientQuestion => (q.type === "mcq" ? { id: q.id, type: "mcq", prompt: q.prompt, options: q.options } : { id: q.id, type: "tf", prompt: q.prompt });
const keyOf = (q: Question, skill: string, unit: number): KeyItem => ({
  id: q.id,
  skill,
  unit,
  answer: q.answer,
  explain: q.explain,
  pages: q.pages ?? [],
  prompt: q.prompt,
  options: q.type === "mcq" ? q.options : undefined,
});

export function composeExam(type: ExamType, unit: number | null, cfg: ExamConfig, seed = Date.now()): ExamPlan {
  const r = rng(seed);
  const units = unit ? PRACTICE.filter((p) => p.unit === unit) : shuffle(PRACTICE, r);
  const sections: ExamSection[] = [];
  const key: KeyItem[] = [];

  const addReading = (max: number) => {
    let n = 0;
    for (const p of units) {
      if (n >= max) break;
      const qs = p.reading.questions.slice(0, Math.min(p.reading.questions.length, max - n));
      sections.push({ kind: "reading", skill: "okuma", title: p.reading.title, text: p.reading.text, questions: qs.map(strip) });
      key.push(...qs.map((q) => keyOf(q, "okuma", p.unit)));
      n += qs.length;
    }
  };
  const addListening = (max: number) => {
    let n = 0;
    for (const p of units) {
      if (n >= max) break;
      const qs = p.listening.questions.slice(0, Math.min(p.listening.questions.length, max - n));
      sections.push({ kind: "listening", skill: "dinleme", title: p.listening.title, lines: p.listening.lines, questions: qs.map(strip) });
      key.push(...qs.map((q) => keyOf(q, "dinleme", p.unit)));
      n += qs.length;
    }
  };
  const addGrammar = (max: number) => {
    const pool = shuffle(units.flatMap((p) => p.grammar.map((q) => ({ q, unit: p.unit }))), r).slice(0, max);
    sections.push({ kind: "mcq", skill: "gramer", title: "Dil Bilgisi · Грамматика", questions: pool.map((x) => strip(x.q)) });
    key.push(...pool.map((x) => keyOf(x.q, "gramer", x.unit)));
  };
  const addVocab = (max: number) => {
    const unitIds = unit ? [unit] : [1, 2, 3, 4, 5, 6, 7, 8];
    const candidates = unitIds.flatMap((u) => wordsForUnit(u, true).map((w) => ({ w, u }))).filter((x) => x.w.kz.length < 60 && x.w.tr.length < 30);
    const picked = shuffle(candidates, r).slice(0, max);
    const qs: Question[] = picked.map(({ w, u }) => {
      const distract = shuffle(candidates.filter((c) => c.w.id !== w.id && c.w.kz !== w.kz), r).slice(0, 3).map((c) => c.w.kz);
      const options = shuffle([w.kz, ...distract], r);
      return { id: `v:${w.id}:${u}`, type: "mcq", prompt: `«${w.tr}» сөзінің мағынасы`, options, answer: options.indexOf(w.kz), explain: `${w.tr} — ${w.kz}.`, pages: [w.page] };
    });
    sections.push({ kind: "mcq", skill: "kelime", title: "Kelime · Сөздік", questions: qs.map(strip) });
    key.push(...qs.map((q, i) => keyOf(q, "kelime", picked[i].u)));
  };
  const addWriting = () => {
    const tasks = units.flatMap((p) => p.writing);
    const t = tasks[Math.floor(r() * tasks.length)];
    sections.push({ kind: "writing", skill: "yazma", task: t });
  };
  const addSpeaking = () => {
    const p = units[0];
    sections.push({ kind: "speaking", skill: "konusma", topic: { tr: p.speaking.topic, kz: p.speaking.kz }, questions: p.speaking.questions.slice(0, cfg.speakingQuestions) });
  };

  let minutes = 20;
  switch (type) {
    case "okuma":
      addReading(cfg.readingQuestions);
      minutes = cfg.minutes.okuma;
      break;
    case "dinleme":
      addListening(cfg.listeningQuestions);
      minutes = cfg.minutes.dinleme;
      break;
    case "gramer":
      addGrammar(cfg.grammarQuestions);
      minutes = 15;
      break;
    case "kelime":
      addVocab(cfg.vocabQuestions);
      minutes = 12;
      break;
    case "yazma":
      addWriting();
      minutes = cfg.minutes.yazma;
      break;
    case "konusma":
      addSpeaking();
      minutes = cfg.minutes.konusma;
      break;
    case "unite":
      addReading(5);
      addListening(4);
      addGrammar(8);
      addVocab(8);
      minutes = 30;
      break;
    case "full":
      addReading(Math.min(cfg.readingQuestions, 10));
      addListening(Math.min(cfg.listeningQuestions, 8));
      addGrammar(8);
      addVocab(8);
      addWriting();
      addSpeaking();
      minutes = cfg.minutes.full;
      break;
  }
  return { type, unit, minutes, sections, key };
}

export type ExamResult = {
  bySkill: Record<string, { correct: number; total: number }>;
  items: (KeyItem & { given: number | boolean | null; correct: boolean })[];
  writing: { text: string; feedback: unknown | null } | null;
  speaking: { sessionId: number | null; feedback: unknown | null } | null;
  recommendedPages: number[];
  weakUnits: number[];
  score: { correct: number; total: number };
};

export function gradeExam(plan: ExamPlan, answers: Record<string, number | boolean>, writing: ExamResult["writing"], speaking: ExamResult["speaking"]): ExamResult {
  const items = plan.key.map((k) => {
    const given = answers[k.id] ?? null;
    return { ...k, given, correct: given !== null && given === k.answer };
  });
  const bySkill: ExamResult["bySkill"] = {};
  for (const it of items) {
    bySkill[it.skill] ??= { correct: 0, total: 0 };
    bySkill[it.skill].total++;
    if (it.correct) bySkill[it.skill].correct++;
  }
  const wrong = items.filter((i) => !i.correct);
  const pageCount = new Map<number, number>();
  for (const w of wrong) for (const p of w.pages) pageCount.set(p, (pageCount.get(p) ?? 0) + 1);
  const unitErr = new Map<number, number>();
  for (const w of wrong) unitErr.set(w.unit, (unitErr.get(w.unit) ?? 0) + 1);
  return {
    bySkill,
    items,
    writing,
    speaking,
    recommendedPages: [...pageCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p]) => p),
    weakUnits: [...unitErr.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u]) => u),
    score: { correct: items.filter((i) => i.correct).length, total: items.length },
  };
}
