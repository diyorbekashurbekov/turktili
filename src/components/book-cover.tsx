"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

/** Original typographic cover inspired by the turquoise identity of the printed book. */
export function CoverArt({ small = false }: { small?: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "#f4f1ea" }}>
      {/* sky + skyline */}
      <svg viewBox="0 0 300 420" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#47c0bd" />
            <stop offset="1" stopColor="#1f9a97" />
          </linearGradient>
        </defs>
        <g stroke="#1c1f23" strokeOpacity="0.55" strokeWidth="1" fill="none" strokeLinecap="round">
          {/* minarets */}
          <path d="M60 268 V196 M58 196 l2 -10 l2 10 M57 214 h6" />
          <path d="M112 268 V184 M110 184 l2 -11 l2 11 M109 204 h6" />
          <path d="M196 268 V190 M194 190 l2 -10 l2 10 M193 210 h6" />
          <path d="M238 268 V202 M236 202 l2 -9 l2 9 M235 220 h6" />
          {/* domes */}
          <path d="M120 268 V250 Q154 214 188 250 V268" />
          <path d="M134 250 Q154 230 174 250" />
          <path d="M150 222 V214 M154 222 V212 M158 222 V214" />
          <path d="M70 268 V258 Q86 240 102 258 V268" />
          <path d="M204 268 V258 Q218 244 232 258 V268" />
          {/* city line */}
          <path d="M8 268 H292" strokeOpacity="0.35" />
          <path d="M14 268 v-8 h10 v-6 h12 v14 M250 268 v-10 h12 v-6 h14 v16" strokeOpacity="0.35" />
        </g>
        <g fill="#1c1f23" fillOpacity="0.55">
          <path d="M226 116 q4 -3 8 0 q4 -3 8 0" stroke="#1c1f23" strokeOpacity="0.5" fill="none" />
          <path d="M248 132 q3 -2 6 0 q3 -2 6 0" stroke="#1c1f23" strokeOpacity="0.4" fill="none" />
        </g>
        <rect x="0" y="268" width="300" height="152" fill="url(#sea)" />
        <g stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" fill="none" strokeLinecap="round">
          <path d="M30 300 q8 -3 16 0 M90 318 q10 -4 20 0 M170 296 q8 -3 16 0 M220 330 q10 -4 20 0 M60 352 q8 -3 16 0 M150 370 q10 -4 20 0" />
        </g>
      </svg>
      {/* title */}
      <div className={`absolute inset-x-0 top-0 ${small ? "p-3" : "p-6 sm:p-7"}`}>
        <div className={`font-serif tracking-[0.18em] text-ink ${small ? "text-[0.7rem]" : "text-[1.35rem] sm:text-[1.55rem]"}`} style={{ fontWeight: 560 }}>
          YEDİ İKLİM
        </div>
        <div className={`mt-1 tracking-[0.32em] text-ink-2 ${small ? "text-[0.45rem]" : "text-[0.62rem]"}`}>TÜRKÇE</div>
      </div>
      <div className={`absolute ${small ? "bottom-3 left-3" : "bottom-6 left-6 sm:bottom-7 sm:left-7"} text-white`}>
        <div className={`font-serif leading-none ${small ? "text-2xl" : "text-[4.2rem] sm:text-[4.8rem]"}`} style={{ fontWeight: 500 }}>
          A1
        </div>
        {!small && <div className="mt-2 text-[0.62rem] tracking-[0.24em] text-white/85">DERS KİTABI</div>}
      </div>
    </div>
  );
}

export function BookObject({ className = "", small = false }: { className?: string; small?: boolean }) {
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: "300 / 420" }}>
      {/* page block */}
      <div
        className="absolute inset-0 translate-x-[6px] translate-y-[4px] rounded-r-[6px] rounded-l-[3px]"
        style={{ background: "repeating-linear-gradient(90deg,#efeae0 0 2px,#e6e0d4 2px 3px)", boxShadow: "0 30px 50px -30px rgb(28 31 35 / 0.45)" }}
      />
      <div className="absolute inset-0 overflow-hidden rounded-r-[6px] rounded-l-[3px] ring-1 ring-black/5">
        <CoverArt small={small} />
        {/* spine light */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[9%]" style={{ background: "linear-gradient(90deg, rgb(0 0 0 / 0.16), rgb(255 255 255 / 0.18) 40%, transparent)" }} />
      </div>
    </div>
  );
}

/** The interactive hero book: tilts gently on hover and opens before navigating. */
export function BookHero({ href = "/kitap" }: { href?: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [opening, setOpening] = useState(false);

  const open = () => {
    if (opening) return;
    if (reduce) return router.push(href);
    setOpening(true);
    router.prefetch(href);
    setTimeout(() => router.push(href), 720);
  };

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Кітапты ашу"
      className="group relative block w-[min(66vw,300px)] sm:w-[320px]"
      style={{ perspective: 1600 }}
    >
      {/* inside page revealed while opening */}
      <div
        className="absolute inset-0 rounded-[6px] bg-surface p-6 text-left ring-1 ring-black/5"
        style={{ boxShadow: "0 30px 60px -30px rgb(28 31 35 / 0.4)" }}
        aria-hidden
      >
        <div className="eyebrow">İçindekiler</div>
        <div className="mt-4 space-y-2.5">
          {["Tanışma", "Ailemiz", "Günlük Hayat", "Çevremiz", "Meslekler", "Ulaşım", "İletişim", "Tatil"].map((t, i) => (
            <div key={t} className="flex items-baseline gap-2 font-serif text-[0.95rem] text-ink-2">
              <span className="w-4 text-xs text-ink-3">{i + 1}</span>
              {t}
              <span className="flex-1 border-b border-dotted border-line-2" />
            </div>
          ))}
        </div>
      </div>
      <motion.div
        className="relative"
        style={{ transformOrigin: "left center", transformStyle: "preserve-3d" }}
        initial={false}
        animate={opening ? { rotateY: -158, x: 0 } : { rotateY: 0 }}
        whileHover={opening || reduce ? undefined : { rotateY: -10, x: 4 }}
        transition={{ duration: opening ? 0.75 : 0.5, ease: [0.22, 0.8, 0.24, 1] }}
      >
        <div style={{ backfaceVisibility: "hidden" }}>
          <BookObject />
        </div>
      </motion.div>
    </button>
  );
}
