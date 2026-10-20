"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, BookmarkCheck, Volume2, X } from "lucide-react";
import { speak } from "@/lib/speech";
import { track } from "@/lib/client";

type Match = { id: string; tr: string; kz: string; page: number; source: string; saved: boolean };
type Open = { term: string; x: number; y: number; bottom: number };

const Ctx = createContext<{ openWord: (term: string, el: HTMLElement) => void }>({ openWord: () => {} });
export const useWord = () => useContext(Ctx);

export function WordProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const openWord = useCallback((term: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setOpen({ term, x: r.left + r.width / 2, y: r.top, bottom: r.bottom });
    setMatches(null);
    fetch(`/api/words?q=${encodeURIComponent(term)}`)
      .then((res) => res.json())
      .then((d) => setMatches(d.matches ?? []))
      .catch(() => setMatches([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !cardRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onScroll = () => setOpen(null);
    window.addEventListener("keydown", close);
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open]);

  const toggleSave = (m: Match) => {
    track({ type: "vocab-save", wordId: m.id, saved: !m.saved });
    setMatches((ms) => ms?.map((x) => (x.id === m.id ? { ...x, saved: !x.saved } : x)) ?? null);
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const below = open ? open.y < 260 : false;
  const style = open
    ? isMobile
      ? { left: 12, right: 12, bottom: 12 }
      : {
          left: Math.min(Math.max(open.x - 160, 12), (typeof window !== "undefined" ? window.innerWidth : 1200) - 332),
          top: below ? open.bottom + 10 : undefined,
          bottom: below ? undefined : (typeof window !== "undefined" ? window.innerHeight : 800) - open.y + 10,
          width: 320,
        }
    : {};

  return (
    <Ctx.Provider value={{ openWord }}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-label={`Сөз: ${open.term}`}
            initial={{ opacity: 0, y: below ? -6 : 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 0.8, 0.24, 1] }}
            className="card fixed z-[60] p-4 shadow-soft"
            style={style}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-serif text-xl leading-tight">{open.term}</div>
              <button className="icon-btn -mr-2 -mt-2 h-8 w-8" onClick={() => setOpen(null)} aria-label="Жабу">
                <X size={16} />
              </button>
            </div>
            {matches === null && (
              <div className="mt-3 space-y-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            )}
            {matches?.length === 0 && (
              <p className="mt-2 text-sm text-ink-2">
                Бұл сөз кітап сөздігінде табылмады. AI мұғалімнен сұрап көріңіз.
              </p>
            )}
            {matches?.map((m) => (
              <div key={m.id} className="mt-3 border-t hairline pt-3 first-of-type:border-0 first-of-type:pt-0">
                <div className="text-[0.95rem] font-medium">{m.tr}</div>
                <div className="mt-0.5 text-ink-2">{m.kz}</div>
                <div className="mt-3 flex items-center gap-1">
                  <button className="btn btn-ghost h-8 px-3 text-xs" onClick={() => speak(m.tr.replace(/\s*\(.*?\)/g, "").split(" / ")[0])}>
                    <Volume2 size={14} /> Тыңдау
                  </button>
                  <button className="btn btn-ghost h-8 px-3 text-xs" onClick={() => speak(m.tr.replace(/\s*\(.*?\)/g, "").split(" / ")[0], { rate: 0.7 })} aria-label="Баяу тыңдау">
                    Баяу
                  </button>
                  <button className="btn btn-ghost h-8 px-3 text-xs" onClick={() => toggleSave(m)} aria-pressed={m.saved}>
                    {m.saved ? <BookmarkCheck size={14} className="text-teal" /> : <Bookmark size={14} />} {m.saved ? "Сақталды" : "Сақтау"}
                  </button>
                  <Link href={`/kitap/${m.page}`} className="ml-auto text-xs text-ink-3 hover:text-teal" onClick={() => setOpen(null)}>
                    {m.source === "index" ? "Dizin" : `${m.page}-бет`}
                  </Link>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

/** Wraps Turkish words of a sentence so each word can be tapped for its meaning. */
export function TappableText({ text, className }: { text: string; className?: string }) {
  const { openWord } = useWord();
  const parts = text.split(/(\p{L}[\p{L}'’]*)/u);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        /^\p{L}/u.test(p) ? (
          <span
            key={i}
            role="button"
            tabIndex={0}
            className="reading-word"
            onClick={(e) => openWord(p.replace(/['’].*$/, ""), e.currentTarget)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openWord(p.replace(/['’].*$/, ""), e.currentTarget)}
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}
