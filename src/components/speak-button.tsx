"use client";

import { Volume2 } from "lucide-react";
import { speak } from "@/lib/speech";

export const ttsText = (tr: string) => tr.replace(/\s*\(.*?\)/g, "").split(" / ")[0].trim();

export function SpeakButton({ text, size = 15 }: { text: string; size?: number }) {
  return (
    <button type="button" className="icon-btn h-8 w-8 shrink-0" onClick={() => speak(ttsText(text))} aria-label={`${text} — тыңдау`}>
      <Volume2 size={size} />
    </button>
  );
}
