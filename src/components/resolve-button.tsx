"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { track } from "@/lib/client";

export function ResolveButton({ ids }: { ids: number[] }) {
  const router = useRouter();
  return (
    <button
      className="btn btn-quiet ml-auto h-8 px-3 text-xs"
      onClick={async () => {
        await track({ type: "resolve", ids });
        router.refresh();
      }}
    >
      <Check size={14} /> Түсіндім
    </button>
  );
}
