"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

export function Greeting({ name }: { name: string | null }) {
  const [text, setText] = useState("Сәлеметсіз бе");
  useEffect(() => {
    const h = new Date().getHours();
    setText(h < 5 ? "Қайырлы түн" : h < 12 ? "Қайырлы таң" : h < 18 ? "Қайырлы күн" : "Қайырлы кеш");
  }, []);
  return (
    <div className="eyebrow" suppressHydrationWarning>
      {text}
      {name ? `, ${name}` : ""}
    </div>
  );
}

export function daysUntil(date: string) {
  const today = new Date();
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const d = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((d - t) / 86_400_000);
}

export function ExamCountdown({ examDate }: { examDate: string | null }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    if (examDate) setDays(daysUntil(examDate));
  }, [examDate]);
  if (!examDate)
    return (
      <Link href="/odak" className="inline-flex items-center gap-1.5 hover:text-teal">
        <CalendarDays size={15} /> Емтихан күнін белгілеу
      </Link>
    );
  return (
    <Link href="/odak" className="inline-flex items-center gap-1.5 hover:text-teal" suppressHydrationWarning>
      <CalendarDays size={15} />
      {days === null ? "…" : days > 0 ? `Емтиханға ${days} күн` : days === 0 ? "Емтихан бүгін — сәттілік!" : "Емтихан өтті"}
    </Link>
  );
}
