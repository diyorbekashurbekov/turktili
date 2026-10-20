"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronDown,
  Dumbbell,
  Headphones,
  Languages,
  ListTree,
  Mic,
  NotebookPen,
  PenLine,
  Sparkles,
  Volume2,
  X,
  Eye,
  SpellCheck,
} from "lucide-react";
import type { BookPage, PageLite, Skill } from "@/content/types";
import { SKILL_LABEL } from "@/content/types";
import { Markdown } from "./markdown";
import { AiChat } from "./ai-chat";
import { Wordmark } from "./shell";
import { track } from "@/lib/client";
import { speak } from "@/lib/speech";

type UnitInfo = { id: number; tr: string; kz: string; from: number; to: number; sections: { code: string; title: string; start: number }[] };

const UNIT_NAMES: Record<number, string> = { 0: "Giriş", 1: "Tanışma", 2: "Ailemiz", 3: "Günlük Hayat", 4: "Çevremiz", 5: "Meslekler", 6: "Ulaşım", 7: "İletişim", 8: "Tatil", 9: "Ekler" };

const CONF_LABEL = {
  derived: { text: "Талдаудан ұсынылған жауап · ресми кілт емес", cls: "bg-surface-2 text-ink-2" },
  uncertain: { text: "Күмәнді жауап — мұғаліммен тексеріңіз", cls: "bg-amber-soft text-amber" },
  "audio-unverified": { text: "Аудиосыз — тексерілмеген жауап", cls: "bg-amber-soft text-amber" },
} as const;

const SKILL_ICON: Record<Skill, typeof BookOpen> = { okuma: BookOpen, dinleme: Headphones, yazma: PenLine, konusma: Mic };

export function BookReader(props: {
  page: BookPage;
  unit: UnitInfo;
  pages: PageLite[];
  statuses: Record<number, string>;
  bookmarked: boolean;
  note: string;
  words: { id: string; tr: string; kz: string }[];
  kelime: { tr: string; kz: string | null; wordId: string | null }[] | null;
  hasImage: boolean;
  audios: { id: number; title: string }[];
  aiReady: boolean;
  hasPractice: boolean;
}) {
  const { page, unit, pages } = props;
  const router = useRouter();
  const reduce = useReducedMotion();
  const [statuses, setStatuses] = useState(props.statuses);
  const [bookmarked, setBookmarked] = useState(props.bookmarked);
  const [tab, setTab] = useState<"lesson" | "words" | "original" | "note">("lesson");
  const [aiOpen, setAiOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [note, setNote] = useState(props.note);
  const [noteSaved, setNoteSaved] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);
  const n = page.n;
  const done = statuses[n] === "completed";

  useEffect(() => {
    setStatuses(props.statuses);
    setBookmarked(props.bookmarked);
    setNote(props.note);
    setTab("lesson");
    setPracticeOpen(false);
    setRailOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    if (!props.statuses[n]) {
      track({ type: "page", page: n, status: "visited" });
      setStatuses((s) => ({ ...s, [n]: "visited" }));
    } else track({ type: "page", page: n, status: "visited" });
  }, [n, props.statuses, props.bookmarked, props.note]);

  const go = (to: number) => {
    if (to >= 1 && to <= 192) router.push(`/kitap/${to}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowRight") go(n + 1);
      if (e.key === "ArrowLeft") go(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggleDone = () => {
    const status = done ? "reset" : "completed";
    track({ type: "page", page: n, status });
    setStatuses((s) => {
      const c = { ...s };
      if (status === "reset") delete c[n];
      else c[n] = "completed";
      return c;
    });
  };

  const toggleBookmark = () => {
    track({ type: "bookmark", page: n, on: !bookmarked });
    setBookmarked(!bookmarked);
  };

  // debounced note autosave
  useEffect(() => {
    if (note === props.note) return;
    setNoteSaved(false);
    const t = setTimeout(() => {
      track({ type: "note", page: n, text: note }).then(() => setNoteSaved(true));
    }, 700);
    return () => clearTimeout(t);
  }, [note, n, props.note]);

  const blocks = page.blocks;
  const summary = blocks.find((b) => b.kind === "summary");
  const rest = blocks.filter((b) => b.kind !== "summary" && b.kind !== "answer");
  const answers = page.answers;
  const vocabCount = props.words.length;

  return (
    <div className="min-h-dvh">
      {/* top bar */}
      <header className="sticky top-0 z-40 border-b hairline bg-bg/88 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
          <button className="icon-btn lg:hidden" onClick={() => setRailOpen(true)} aria-label="Мазмұны">
            <ListTree size={19} />
          </button>
          <div className="hidden lg:block">
            <Wordmark />
          </div>
          <div className="mx-auto flex min-w-0 items-center gap-2 text-sm text-ink-2 lg:ml-10 lg:mr-0">
            <Link href="/kitap" className="hidden hover:text-ink sm:inline">
              İçindekiler
            </Link>
            <span className="hidden text-ink-3 sm:inline">/</span>
            <span className="truncate">
              {unit.id >= 1 && unit.id <= 8 ? `${unit.id}. ${unit.tr}` : UNIT_NAMES[unit.id]}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <PageJump current={n} onGo={go} />
            <button className={`btn ${aiOpen ? "btn-teal" : "btn-ghost"} ml-1 h-9 px-3`} onClick={() => setAiOpen((v) => !v)} aria-expanded={aiOpen}>
              <Sparkles size={16} /> <span className="hidden sm:inline">Мұғалім</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* chapter rail — desktop */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[280px] shrink-0 overflow-y-auto border-r hairline lg:block">
          <Rail pages={pages} current={n} statuses={statuses} unitId={unit.id} />
        </aside>

        {/* page */}
        <main ref={mainRef} className="min-w-0 flex-1 pb-36">
          <AnimatePresence mode="wait">
            <motion.article
              key={n}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.32, ease: [0.22, 0.8, 0.24, 1] }}
              className="mx-auto max-w-[760px] px-5 pt-10 sm:px-8"
            >
              <div className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{unit.id >= 1 && unit.id <= 8 ? `Ünite ${unit.id} · ${unit.tr}` : UNIT_NAMES[unit.id]}</span>
                {page.section && (
                  <>
                    <span className="text-line-2">•</span>
                    <span>
                      {page.section.code}. {page.section.title}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-4 flex items-start gap-5">
                <div className="font-serif text-[2.6rem] leading-[0.9] text-teal sm:text-[4rem]" aria-label={`${n}-бет`}>
                  {page.range ? `${page.range[0]}–${page.range[1]}` : n}
                </div>
                <h1 className="pt-1 font-serif text-[1.3rem] leading-tight sm:text-[1.9rem]" style={{ fontWeight: 480 }}>
                  {page.title}
                </h1>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {page.skills.map((s) => {
                  const Icon = SKILL_ICON[s];
                  return (
                    <span key={s} className="chip">
                      <Icon size={13} /> {SKILL_LABEL[s].tr}
                    </span>
                  );
                })}
                {props.kelime && (
                  <span className="chip border-teal/30 bg-teal-soft text-teal-ink">
                    <Languages size={13} /> Kelime Dünyası
                  </span>
                )}
                {done && (
                  <span className="chip border-green/20 bg-green-soft text-green">
                    <Check size={13} /> Аяқталды
                  </span>
                )}
              </div>

              {/* tabs */}
              <div className="mt-8 flex gap-6 border-b hairline text-sm" role="tablist">
                {(
                  [
                    ["lesson", "Сабақ"],
                    ["words", `Сөздер${vocabCount ? ` · ${vocabCount}` : ""}`],
                    ...(props.hasImage ? [["original", "Түпнұсқа бет"]] : []),
                    ["note", "Жазба"],
                  ] as [typeof tab, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={`relative -mb-px pb-3 transition-colors ${tab === k ? "text-ink" : "text-ink-3 hover:text-ink-2"}`}
                  >
                    {label}
                    {tab === k && <motion.span layoutId="tab-underline" className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-teal" />}
                  </button>
                ))}
              </div>

              <div className="pt-8">
                {tab === "lesson" && (
                  <div className="space-y-10">
                    {page.kind === "blank" && <p className="text-ink-2">Бұл бет кітапта бос.</p>}
                    {summary && (
                      <section>
                        <div className="eyebrow mb-3">Бетте не бар</div>
                        <Markdown>{summary.text}</Markdown>
                      </section>
                    )}
                    {rest.map((b, i) => (
                      <section key={i}>
                        <div className="eyebrow mb-3">{labelFor(b.label, b.kind)}</div>
                        <Markdown vocab={b.kind === "vocab"}>{b.text}</Markdown>
                      </section>
                    ))}
                    {answers.length > 0 && (
                      <section className="rounded-[14px] border hairline bg-surface p-5 sm:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="eyebrow">Тапсырма жауаптары</div>
                        </div>
                        <AnswerReveal answers={answers} />
                      </section>
                    )}
                    {props.audios.length > 0 && (
                      <section>
                        <div className="eyebrow mb-3">Түпнұсқа аудио</div>
                        {props.audios.map((a) => (
                          <div key={a.id} className="mb-3">
                            <div className="mb-1 text-sm text-ink-2">{a.title}</div>
                            <audio controls preload="none" src={`/api/audio/${a.id}`} className="w-full" />
                          </div>
                        ))}
                        <p className="text-xs text-ink-3">Әкімші рұқсатпен жүктеген кітап аудиосы.</p>
                      </section>
                    )}
                    <p className="border-t hairline pt-6 text-xs leading-relaxed text-ink-3">
                      Мазмұн кітап бетінің толық талдауынан алынған (192/192 бет өңделген). Авторлық құқыққа байланысты түпнұсқа мәтін сөзбе-сөз көшірілмеген.
                    </p>
                  </div>
                )}

                {tab === "words" && <WordsTab words={props.words} kelime={props.kelime} unit={unit.id} />}

                {tab === "original" && props.hasImage && (
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/page-image/${n}`} alt={`Кітаптың ${n}-беті`} className="w-full rounded-lg border hairline bg-white" loading="lazy" />
                    <figcaption className="mt-3 text-xs text-ink-3">Түпнұсқа бет — рұқсатпен көрсетіледі. Үлкейту үшін суретті жаңа бетте ашыңыз.</figcaption>
                  </figure>
                )}

                {tab === "note" && (
                  <div>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={10}
                      className="input font-[inherit]"
                      placeholder="Осы бетке өз жазбаңыз…"
                      aria-label="Бет жазбасы"
                    />
                    <div className="mt-2 text-xs text-ink-3">{noteSaved ? "Сақталды" : "Сақталуда…"}</div>
                  </div>
                )}
              </div>
            </motion.article>
          </AnimatePresence>
        </main>

        {/* AI panel — desktop */}
        <AnimatePresence>
          {aiOpen && (
            <motion.aside
              initial={reduce ? false : { width: 0, opacity: 0 }}
              animate={{ width: 420, opacity: 1 }}
              exit={reduce ? undefined : { width: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 0.8, 0.24, 1] }}
              className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 overflow-hidden border-l hairline bg-surface lg:block"
              aria-label="AI мұғалім"
            >
              <div className="flex h-full w-[420px] flex-col">
                <div className="flex items-center justify-between border-b hairline px-5 py-3">
                  <div>
                    <div className="text-sm font-semibold">Мұғалім</div>
                    <div className="text-xs text-ink-3">{n}-бет бойынша</div>
                  </div>
                  <button className="icon-btn" onClick={() => setAiOpen(false)} aria-label="Жабу">
                    <X size={17} />
                  </button>
                </div>
                <AiChat page={n} aiReady={props.aiReady} compact />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* AI sheet — mobile/tablet */}
      <AnimatePresence>
        {aiOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-black/20 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setAiOpen(false)}
          >
            <motion.div
              className="safe-bottom mt-auto flex h-[86dvh] flex-col rounded-t-[22px] bg-surface"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.22, 0.8, 0.24, 1] }}
            >
              <div className="flex items-center justify-between px-5 pb-2 pt-3">
                <div>
                  <div className="text-sm font-semibold">Мұғалім</div>
                  <div className="text-xs text-ink-3">{n}-бет бойынша</div>
                </div>
                <button className="icon-btn" onClick={() => setAiOpen(false)} aria-label="Жабу">
                  <X size={18} />
                </button>
              </div>
              <AiChat page={n} aiReady={props.aiReady} compact />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* rail — mobile */}
      <AnimatePresence>
        {railOpen && (
          <motion.div className="fixed inset-0 z-50 bg-black/20 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && setRailOpen(false)}>
            <motion.div
              className="h-full w-[86vw] max-w-[340px] overflow-y-auto bg-bg"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.22, 0.8, 0.24, 1] }}
            >
              <div className="flex items-center justify-between border-b hairline px-4 py-3">
                <Wordmark />
                <button className="icon-btn" onClick={() => setRailOpen(false)} aria-label="Жабу">
                  <X size={18} />
                </button>
              </div>
              <Rail pages={pages} current={n} statuses={statuses} unitId={unit.id} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* learning toolbar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 lg:pl-[280px]" style={{ paddingRight: aiOpen ? undefined : undefined }}>
        <div className={`pointer-events-auto relative flex items-center gap-1 rounded-full border hairline bg-surface/95 p-1.5 shadow-soft backdrop-blur-md ${aiOpen ? "lg:mr-[420px]" : ""}`}>
          <button className="icon-btn" onClick={() => go(n - 1)} disabled={n <= 1} aria-label="Алдыңғы бет">
            <ArrowLeft size={18} />
          </button>
          <div className="relative">
            <button className="btn btn-quiet h-10 px-3" onClick={() => setPracticeOpen((v) => !v)} aria-expanded={practiceOpen} disabled={!props.hasPractice}>
              <Dumbbell size={17} /> <span className="hidden sm:inline">Жаттығу</span> <ChevronDown size={14} className={`transition-transform ${practiceOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {practiceOpen && props.hasPractice && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="card absolute bottom-14 left-1/2 w-64 -translate-x-1/2 p-2 shadow-soft"
                >
                  <div className="px-3 pb-1 pt-2 text-xs text-ink-3">{unit.id}-тарау жаттығулары</div>
                  {[
                    { href: `/pratik/${unit.id}/okuma`, icon: BookOpen, label: "Оқу · Okuma" },
                    { href: `/pratik/${unit.id}/dinleme`, icon: Headphones, label: "Тыңдау · Dinleme" },
                    { href: `/pratik/${unit.id}/gramer`, icon: SpellCheck, label: "Грамматика · Dil bilgisi" },
                    { href: `/pratik/${unit.id}/yazma`, icon: PenLine, label: "Жазу · Yazma" },
                    { href: `/pratik/${unit.id}/konusma`, icon: Mic, label: "Сөйлеу · Konuşma" },
                    { href: `/kelime/${unit.id}`, icon: Languages, label: "Сөздер · Kelime Dünyası" },
                  ].map((it) => (
                    <Link key={it.href} href={it.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2">
                      <it.icon size={16} className="text-teal" /> {it.label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button className="btn btn-quiet h-10 px-3" onClick={() => setTab("words")}>
            <Languages size={17} /> <span className="hidden sm:inline">Сөздер</span>
          </button>
          <button className="icon-btn" onClick={toggleBookmark} aria-pressed={bookmarked} aria-label="Бетбелгі">
            {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
          <button className="icon-btn" onClick={() => setTab("note")} aria-label="Жазба">
            <NotebookPen size={18} />
          </button>
          <button className={`btn h-10 px-4 ${done ? "bg-green-soft text-green" : "btn-primary"}`} onClick={toggleDone}>
            <Check size={16} /> <span className="hidden sm:inline">{done ? "Аяқталды" : "Аяқтау"}</span>
          </button>
          <button className="icon-btn" onClick={() => go(n + 1)} disabled={n >= 192} aria-label="Келесі бет">
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function labelFor(label: string, kind: string) {
  if (kind === "vocab") return "Сөздік";
  if (kind === "grammar") return "Грамматика";
  return label || "Ескерту";
}

function AnswerReveal({ answers }: { answers: BookPage["answers"] }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-3">
      {!show ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-2">Алдымен тапсырманы өзіңіз орындап көріңіз.</p>
          <button className="btn btn-ghost h-9" onClick={() => setShow(true)}>
            <Eye size={15} /> Жауаптарды көрсету
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {answers.map((a, i) => (
            <div key={i}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{a.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-medium ${CONF_LABEL[a.confidence].cls}`}>{CONF_LABEL[a.confidence].text}</span>
              </div>
              <Markdown>{a.text}</Markdown>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WordsTab({ words, kelime, unit }: { words: { id: string; tr: string; kz: string }[]; kelime: { tr: string; kz: string | null }[] | null; unit: number }) {
  return (
    <div className="space-y-10">
      {kelime && (
        <section>
          <div className="eyebrow mb-3 text-teal">Kelime Dünyası</div>
          <div className="grid gap-px overflow-hidden rounded-[14px] border hairline bg-line sm:grid-cols-2">
            {kelime.map((k) => (
              <div key={k.tr} className="flex items-center gap-3 bg-surface px-4 py-3">
                <button className="icon-btn h-8 w-8 shrink-0" onClick={() => speak(k.tr)} aria-label={`${k.tr} тыңдау`}>
                  <Volume2 size={15} />
                </button>
                <div className="min-w-0">
                  <div className="font-medium">{k.tr}</div>
                  <div className="text-sm text-ink-2">{k.kz ?? "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <section>
        <div className="flex items-baseline justify-between">
          <div className="eyebrow mb-3">Беттің сөздігі</div>
          {unit >= 1 && unit <= 8 && (
            <Link href={`/kelime/${unit}`} className="text-sm text-teal hover:underline">
              Жаттықтыру →
            </Link>
          )}
        </div>
        {words.length === 0 ? (
          <p className="text-sm text-ink-2">Бұл бетте жаңа сөз жоқ.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)] rounded-[14px] border hairline bg-surface">
            {words.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                <button className="icon-btn h-8 w-8 shrink-0" onClick={() => speak(w.tr.replace(/\s*\(.*?\)/g, "").split(" / ")[0])} aria-label={`${w.tr} тыңдау`}>
                  <Volume2 size={15} />
                </button>
                <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
                  <div className="font-medium sm:w-1/2">{w.tr}</div>
                  <div className="text-sm text-ink-2 sm:w-1/2">{w.kz}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-3">Дыбыс — браузердің түрік тіліндегі синтезі (TTS), кітаптың түпнұсқа аудиосы емес.</p>
      </section>
    </div>
  );
}

function PageJump({ current, onGo }: { current: number; onGo: (n: number) => void }) {
  const [v, setV] = useState(String(current));
  useEffect(() => setV(String(current)), [current]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const x = parseInt(v);
        if (x >= 1 && x <= 192) onGo(x);
      }}
      className="flex items-center gap-1 rounded-full border hairline bg-surface px-3 py-1 text-sm"
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value.replace(/\D/g, "").slice(0, 3))}
        className="w-8 bg-transparent text-right tabular-nums outline-none"
        inputMode="numeric"
        aria-label="Бет нөмірі"
      />
      <span className="text-ink-3">/ 192</span>
    </form>
  );
}

function Rail({ pages, current, statuses, unitId }: { pages: PageLite[]; current: number; statuses: Record<number, string>; unitId: number }) {
  const [openUnit, setOpenUnit] = useState(unitId);
  useEffect(() => setOpenUnit(unitId), [unitId]);
  const groups = useMemo(() => {
    const m = new Map<number, PageLite[]>();
    for (const p of pages) {
      if (p.range && p.range[0] !== p.n) continue;
      m.set(p.unit, [...(m.get(p.unit) ?? []), p]);
    }
    return [...m.entries()];
  }, [pages]);
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" });
  }, [current]);

  return (
    <nav className="py-4" aria-label="Кітап беттері">
      {groups.map(([u, ps]) => {
        const isOpen = openUnit === u;
        const doneCount = ps.filter((p) => statuses[p.n] === "completed").length;
        return (
          <div key={u} className="px-3">
            <button
              onClick={() => setOpenUnit(isOpen ? -1 : u)}
              className={`flex w-full items-baseline gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2 ${isOpen ? "text-ink" : "text-ink-2"}`}
              aria-expanded={isOpen}
            >
              <span className="w-4 font-serif text-sm text-ink-3">{u >= 1 && u <= 8 ? u : ""}</span>
              <span className="flex-1 font-serif text-[1.02rem]">{UNIT_NAMES[u]}</span>
              <span className="text-[0.7rem] tabular-nums text-ink-3">
                {doneCount}/{ps.length}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden pb-2">
                  {ps.map((p) => {
                    const active = p.n === current || (p.range && current >= p.range[0] && current <= p.range[1]);
                    const st = statuses[p.n];
                    return (
                      <li key={p.n}>
                        <Link
                          ref={active ? activeRef : undefined}
                          href={`/kitap/${p.n}`}
                          className={`group flex items-center gap-3 rounded-lg py-1.5 pl-9 pr-2 text-[0.85rem] transition-colors ${active ? "bg-teal-soft text-teal-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
                          aria-current={active ? "page" : undefined}
                        >
                          <span className="w-7 shrink-0 tabular-nums text-ink-3 group-aria-[current=page]:text-teal-ink">{p.range ? `${p.range[0]}+` : p.n}</span>
                          <span className="min-w-0 flex-1 truncate">{p.title}</span>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st === "completed" ? "bg-teal" : st === "visited" ? "bg-teal/30" : "bg-transparent"}`} />
                        </Link>
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}
