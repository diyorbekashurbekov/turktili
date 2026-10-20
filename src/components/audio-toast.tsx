"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { VolumeX, X } from "lucide-react";

/** Shows why Turkish audio could not play (instead of silently using a wrong-language voice). */
export function AudioErrorToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg(String((e as CustomEvent).detail ?? "Дыбыс ойнатылмады."));
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 7000);
    };
    window.addEventListener("yi-audio-error", on);
    return () => {
      window.removeEventListener("yi-audio-error", on);
      clearTimeout(t);
    };
  }, []);
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-2xl border hairline bg-surface px-4 py-3 text-sm shadow-lg"
        >
          <VolumeX size={17} className="mt-0.5 shrink-0 text-amber" />
          <p className="flex-1 text-ink-2">{msg}</p>
          <button className="text-ink-3 hover:text-ink" onClick={() => setMsg(null)} aria-label="Жабу">
            <X size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
