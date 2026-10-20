export type Skill = "okuma" | "dinleme" | "yazma" | "konusma";

export type PageBlock = { label: string; text: string; kind: "summary" | "vocab" | "grammar" | "answer" | "sample" | "note" };

export type AnswerConfidence = "derived" | "uncertain" | "audio-unverified";

export type BookPage = {
  n: number;
  range: [number, number] | null;
  title: string;
  unit: number;
  section: { code: string; title: string } | null;
  kind: "lesson" | "cover" | "assessment" | "self-assessment" | "front" | "appendix" | "blank";
  summary: string;
  blocks: PageBlock[];
  skills: Skill[];
  kelimeDunyasi: string[] | null;
  answers: { label: string; text: string; confidence: AnswerConfidence }[];
  status: string;
  verified: boolean;
  needsReview: boolean;
};

export type Unit = {
  id: number;
  slug: string;
  tr: string;
  kz: string;
  from: number;
  to: number;
  sections: { code: string; title: string; start: number }[];
  grammar: string[];
};

export type Word = {
  id: string;
  tr: string;
  kz: string;
  page: number;
  pages: number[];
  unit: number;
  source: "page" | "index" | "supplement";
};

export type KelimeSet = { page: number; unit: number; items: { tr: string; kz: string | null; wordId: string | null }[] };

export type PageLite = Pick<BookPage, "n" | "title" | "unit" | "section" | "kind" | "skills" | "range"> & {
  hasKelime: boolean;
};

export const SKILL_LABEL: Record<Skill, { tr: string; kz: string }> = {
  okuma: { tr: "Okuma", kz: "Оқу" },
  dinleme: { tr: "Dinleme", kz: "Тыңдау" },
  yazma: { tr: "Yazma", kz: "Жазу" },
  konusma: { tr: "Konuşma", kz: "Сөйлеу" },
};
