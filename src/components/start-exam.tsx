"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { post } from "@/lib/client";

export function StartExam({ type, unit, label, primary, small }: { type: string; unit?: number; label: string; primary?: boolean; small?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`btn ${primary ? "btn-primary h-11 px-6" : "btn-ghost"} ${small ? "h-9 w-full" : ""}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { id } = await post<{ id: number }>("/api/exams", { action: "start", type, unit: unit ?? null });
          router.push(`/sinav/${id}`);
        } catch {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : null} {label} {!busy && <ArrowRight size={15} />}
    </button>
  );
}
