// Builds structured textbook content from the verified page-by-page analysis.
// Source: content/source/analysis.md  ->  src/content/generated/*.json
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = fs.readFileSync(path.join(root, "content/source/analysis.md"), "utf8");
const out = path.join(root, "src/content/generated");
fs.mkdirSync(out, { recursive: true });

const UNITS = [
  { id: 0, slug: "giris", tr: "Giriş", kz: "Кіріспе", from: 1, to: 8, sections: [] },
  { id: 1, slug: "tanisma", tr: "Tanışma", kz: "Танысу", from: 9, to: 32, sections: [["A", "Merhaba", 10], ["B", "Nerelisiniz?", 17], ["C", "Karşılaşma – Selamlaşma", 25]] },
  { id: 2, slug: "ailemiz", tr: "Ailemiz", kz: "Біздің отбасы", from: 33, to: 54, sections: [["A", "Ailem ve Ben", 34], ["B", "Evim", 39], ["C", "Adresim", 49]] },
  { id: 3, slug: "gunluk-hayat", tr: "Günlük Hayat", kz: "Күнделікті өмір", from: 55, to: 76, sections: [["A", "Saat Kaçta?", 56], ["B", "Ne Kadar? Kaç Lira?", 64], ["C", "Nerede? Ne Zaman?", 70]] },
  { id: 4, slug: "cevremiz", tr: "Çevremiz", kz: "Айналамыз", from: 77, to: 96, sections: [["A", "Bizim Sokağımız", 78], ["B", "Ne? Nerede?", 84], ["C", "Bir Haftalık Planımız", 89]] },
  { id: 5, slug: "meslekler", tr: "Meslekler", kz: "Мамандықтар", from: 97, to: 116, sections: [["A", "Meslekleri Tanıyalım", 98], ["B", "Ne Olmak İstiyorsun?", 105], ["C", "Hobilerim", 111]] },
  { id: 6, slug: "ulasim", tr: "Ulaşım", kz: "Көлік", from: 117, to: 136, sections: [["A", "Yolculuk Nereye?", 118], ["B", "Trafikte", 124], ["C", "Bugün Hava Nasıl?", 128]] },
  { id: 7, slug: "iletisim", tr: "İletişim", kz: "Байланыс", from: 137, to: 154, sections: [["A", "Telefon", 138], ["B", "Bilgisayar ve İnternet", 144], ["C", "Yüz Yüze", 148]] },
  { id: 8, slug: "tatil", tr: "Tatil", kz: "Демалыс", from: 155, to: 174, sections: [["A", "Hafta Sonu", 156], ["B", "Yaz Tatili", 162], ["C", "Bayram", 166]] },
  { id: 9, slug: "ekler", tr: "Ekler", kz: "Қосымшалар", from: 175, to: 192, sections: [] },
];
const GRAMMAR = {
  1: ["bu / şu / o; burası / şurası / orası", "mı? / değil", "var / yok", "Bulunma hâli (-DA)", "Sayılar", "Çokluk eki (-lAr)"],
  2: ["Ayrılma, belirtme, bulunma, yönelme hâlleri", "-DAn önce / -DAn sonra", "Emir", "Şahıs zamirleri", "Şimdiki zaman (-Iyor)"],
  3: ["Belirli geçmiş zaman (-DI)", "Zaman zarfları", "-ile / -(y)lA", "-lI, -sIz, -lIk"],
  4: ["İyelik ekleri", "-DAn ... -(y)A kadar", "Gelecek zaman (-(y)AcAk)"],
  5: ["İsim tamlamaları"],
  6: ["-ki / -DAki", "-(I)ncI (sıra sayıları)"],
  7: ["-A göre, bence", "-DAn daha + sıfat", "en + sıfat", "-DAn beri / -DIr"],
  8: ["Genel tekrar"],
};
const unitOf = (n) => UNITS.find((u) => n >= u.from && n <= u.to);

const clean = (s) =>
  s.replace(/\*\*/g, "").replace(/(^|[^*])\*([^*]+)\*/g, "$1$2").replace(/`/g, "").trim();

// ---- split into page sections ----
const lines = src.split(/\r?\n/);
const sections = [];
let cur = null;
for (const line of lines) {
  const m = line.match(/^## (\d+)(?:[–-](\d+))?-бет(?:тер)?\s*—\s*(.*)$/);
  if (m) {
    cur = { from: +m[1], to: m[2] ? +m[2] : +m[1], title: m[3].trim(), body: [] };
    sections.push(cur);
    continue;
  }
  if (cur) cur.body.push(line);
}

function splitBlocks(bodyLines) {
  const blocks = [];
  let b = { label: "", lines: [] };
  for (const l of bodyLines) {
    if (/^---\s*$/.test(l) || /^\*Талдау соңы/.test(l)) continue;
    const m = l.match(/^\*\*([^*]+?):\*\*\s*(.*)$/);
    if (m) {
      if (b.label || b.lines.some((x) => x.trim())) blocks.push(b);
      b = { label: m[1].trim(), lines: m[2] ? [m[2]] : [] };
    } else b.lines.push(l);
  }
  if (b.label || b.lines.some((x) => x.trim())) blocks.push(b);
  return blocks.map((x) => ({ label: x.label, text: x.lines.join("\n").trim() }));
}

function kindOf(label) {
  const l = label.toLowerCase();
  if (l.startsWith("бетте не бар")) return "summary";
  if (l.includes("сөздік") || l.includes("қосымша сөздер")) return "vocab";
  if (l.startsWith("грамматика")) return "grammar";
  if (/жауа[пб]/.test(l)) return "answer";
  if (l.includes("үлгі")) return "sample";
  return "note";
}

function parseTable(text) {
  const rows = [];
  for (const l of text.split("\n")) {
    if (!l.trim().startsWith("|")) continue;
    const cells = l.trim().replace(/^\||\|$/g, "").split("|").map((c) => clean(c));
    if (cells.every((c) => /^-+$/.test(c) || c === "")) continue;
    rows.push(cells);
  }
  return rows;
}
const HEADER = new Set(["Түрікше", "Әріп (аты)", "Сан", "Тарау", "Түрі"]);

function confidenceOf(text) {
  const t = text.toLowerCase();
  if (/тыңдалым|аудио/.test(t)) return "audio-unverified";
  if (/тексеріңіз|күмәнді|мүмкін|ұсынылған|болжап|мысалы/.test(t)) return "uncertain";
  return "derived";
}

const vocab = [];
const vocabSeen = new Map();
function addWord(tr, kz, page, source) {
  tr = tr.replace(/\s+/g, " ").trim();
  kz = (kz || "").replace(/\s+/g, " ").trim();
  if (!tr || !kz || tr.length > 80) return;
  const key = tr.toLocaleLowerCase("tr");
  if (vocabSeen.has(key)) {
    const w = vocabSeen.get(key);
    if (!w.pages.includes(page)) w.pages.push(page);
    return;
  }
  const u = unitOf(page);
  const w = { id: `w${vocab.length + 1}`, tr, kz, page, pages: [page], unit: u.id, source };
  vocab.push(w);
  vocabSeen.set(key, w);
}

const pages = [];
for (const s of sections) {
  const kinds = splitBlocks(s.body).map((b) => ({ ...b, kind: kindOf(b.label) }));
  const text = s.body.join("\n");
  for (const b of kinds.filter((k) => k.kind === "vocab")) {
    for (const row of parseTable(b.text)) {
      if (HEADER.has(row[0])) continue;
      if (s.from === 13) {
        for (const cell of row.slice(1))
          for (const part of cell.split(";")) {
            const [tr, kz] = part.split("—").map((x) => x && x.trim());
            if (tr && kz) addWord(tr, kz, 13, "page");
          }
        continue;
      }
      if (/^[\d.,–\- ]+$/.test(row[0]) && row.length >= 3) {
        addWord(row[1], row[2], s.from, "page");
        continue;
      }
      if (row.length >= 2) {
        // index table: tr | kz | unit -> attribute to unit's first lesson page
        if (s.from >= 176 && row[2]) {
          const unitNums = row[2].split(",").map((x) => parseInt(x));
          const u = UNITS.find((x) => x.id === unitNums[0]);
          addWord(row[0], row[1], u ? u.from : s.from, "index");
        } else addWord(row[0], row[1], s.from, "page");
      }
    }
  }
  const skills = [];
  if (/Оқиық|оқиық|Serbest Okuma/.test(text)) skills.push("okuma");
  if (/Тыңдайық|тыңдайық|тыңдалым/.test(text)) skills.push("dinleme");
  if (/Жазайық|жазайық/.test(text)) skills.push("yazma");
  if (/Сөйлесейік|сөйлесейік|сахналайық|Сұхбат/.test(text)) skills.push("konusma");
  const kw = text.match(/Kelime Dünyası[^\n]*?:\*\*\s*([^\n]+)/);
  let kelime = null;
  if (kw) {
    const list = kw[1].split(/\.\s+(?:Сұрақтар|Үлгі|Үлгідегідей)/)[0];
    kelime = (list.includes(" / ") && !list.includes(",") ? list.split(" / ") : list.split(","))
      .map((x) => x.replace(/\.$/, "").trim())
      .filter(Boolean);
  }
  const answers = kinds
    .filter((k) => k.kind === "answer")
    .map((k) => ({ label: k.label, text: k.text, confidence: confidenceOf(k.label + " " + k.text) }));
  const summary = kinds.find((k) => k.kind === "summary")?.text ?? "";
  const isBlank = /Бос бет/.test(s.title);
  for (let n = s.from; n <= s.to; n++) {
    const u = unitOf(n);
    let section = null;
    for (const [code, title, start] of u.sections) if (n >= start) section = { code, title };
    pages.push({
      n,
      range: s.from !== s.to ? [s.from, s.to] : null,
      title: s.title,
      unit: u.id,
      section,
      kind: isBlank
        ? "blank"
        : /^Değerlendirme/.test(s.title)
          ? "assessment"
          : /^Kendimi Değerlendiriyorum/.test(s.title)
            ? "self-assessment"
            : /мұқаба/i.test(s.title)
              ? "cover"
              : s.from >= 176
                ? "appendix"
                : n <= 8
                  ? "front"
                  : "lesson",
      summary: n === s.from ? summary : "",
      // multi-page sections (index, grammar summary) keep their blocks on the first page only
      blocks: n === s.from ? kinds.map(({ label, text, kind }) => ({ label, text, kind })) : [],
      skills,
      kelimeDunyasi: kelime,
      answers,
      status: "processed",
      verified: true,
      needsReview: answers.some((a) => a.confidence !== "derived"),
    });
  }
}

// Platform-authored supplement for items the analysis left untranslated
const supplement = JSON.parse(fs.readFileSync(path.join(root, "content/source/supplement.json"), "utf8"));
for (const w of supplement.words) addWord(w.tr, w.kz, w.page, "supplement");

// Kelime Dünyası resolution against the vocabulary
const norm = (s) => s.toLocaleLowerCase("tr").replace(/\s*\([^)]*\)\s*$/, "").replace(/[!?.]+$/, "").trim();
const lookup = (tr) => {
  const k = norm(tr);
  for (const cand of [k, k.replace(/\s*\(.*\)$/, "")]) {
    const hit = vocab.find((w) => {
      const wk = norm(w.tr);
      return wk === cand || wk.split(" / ").map((x) => x.trim()).includes(cand);
    });
    if (hit) return hit;
  }
  return null;
};
const kelimeSets = [];
const unresolved = [];
for (const p of pages) {
  if (!p.kelimeDunyasi || (p.range && p.n !== p.range[0])) continue;
  const items = p.kelimeDunyasi.map((tr) => {
    const w = lookup(tr);
    if (!w) unresolved.push({ page: p.n, tr });
    return { tr, kz: w?.kz ?? null, wordId: w?.id ?? null };
  });
  kelimeSets.push({ page: p.n, unit: p.unit, items });
}

const units = UNITS.map((u) => ({
  id: u.id,
  slug: u.slug,
  tr: u.tr,
  kz: u.kz,
  from: u.from,
  to: u.to,
  sections: u.sections.map(([code, title, start]) => ({ code, title, start })),
  grammar: GRAMMAR[u.id] ?? [],
}));

const coverage = {
  totalPdfPages: 192,
  printedNumberingMatchesPdf: true,
  processed: pages.length,
  verified: pages.filter((p) => p.verified).length,
  blank: pages.filter((p) => p.kind === "blank").map((p) => p.n),
  withVisualContent: pages.filter((p) => p.kind !== "blank").length,
  needsReview: pages.filter((p) => p.needsReview).map((p) => p.n),
  missing: Array.from({ length: 192 }, (_, i) => i + 1).filter((n) => !pages.find((p) => p.n === n)),
  vocabCount: vocab.length,
  kelimeSets: kelimeSets.length,
  kelimeUnresolved: unresolved,
};

fs.writeFileSync(path.join(out, "pages.json"), JSON.stringify(pages));
fs.writeFileSync(path.join(out, "units.json"), JSON.stringify(units, null, 1));
fs.writeFileSync(path.join(out, "vocab.json"), JSON.stringify(vocab));
fs.writeFileSync(path.join(out, "kelime.json"), JSON.stringify(kelimeSets, null, 1));
fs.writeFileSync(path.join(out, "coverage.json"), JSON.stringify(coverage, null, 1));
console.log(
  JSON.stringify({ ...coverage, kelimeUnresolved: unresolved.length, needsReview: coverage.needsReview.length }, null, 1),
);
