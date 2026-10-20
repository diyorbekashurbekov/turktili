"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Loader2, RefreshCw, Settings2, X } from "lucide-react";
import { post } from "@/lib/client";
import type { UnitStatus } from "@/lib/plan";

type Task = { id: number; day: string; position: number; kind: string; ref: string; title: string; minutes: number; done_at: string | null };
type Plan = { id: number; exam_date: string; start_date: string; mode: string };

const UNIT_TR = ["", "Tanışma", "Ailemiz", "Günlük Hayat", "Çevremiz", "Meslekler", "Ulaşım", "İletişim", "Tatil"];

export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diff(a: string, b: string) {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000);
}

export function taskHref(t: { kind: string; ref: string }) {
  switch (t.kind) {
    case "vocab":
      return t.ref === "due" ? "/kelime/calis?set=due&mode=flash" : `/kelime/calis?set=${t.ref}&mode=flash`;
    case "pages":
      return `/kitap/${t.ref.split("-")[0]}`;
    case "okuma":
    case "dinleme":
    case "gramer":
    case "yazma":
    case "konusma":
      return `/pratik/${t.ref}/${t.kind}`;
    case "mistakes":
      return "/hatalar";
    case "exam":
      return "/sinav";
    default:
      return "/kitap";
  }
}

const DAY_KZ = ["Жс", "Дс", "Сс", "Ср", "Бс", "Жм", "Сн"];

export function FocusMode({ plan, tasks: initial, units, due, mistakes }: { plan: Plan | null; tasks: Task[]; units: UnitStatus[]; due: number; mistakes: number }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [today, setToday] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setToday(localToday()), []);
  useEffect(() => setTasks(initial), [initial]);

  if (!plan) return <Setup units={units} />;
  if (!today) return <div className="min-h-dvh" />;

  const daysLeft = diff(today, plan.exam_date);
  const todays = tasks.filter((t) => t.day === today);
  const missed = tasks.filter((t) => t.day < today && !t.done_at);
  const current = todays.find((t) => !t.done_at);
  const doneToday = todays.filter((t) => t.done_at).length;
  const pct = todays.length ? doneToday / todays.length : 0;
  const days = [...new Set(tasks.map((t) => t.day))];

  const toggle = async (t: Task) => {
    const done = !t.done_at;
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done_at: done ? new Date().toISOString() : null } : x)));
    await post("/api/focus", { action: "toggle", taskId: t.id, done }).catch(() => router.refresh());
  };
  const recalc = async () => {
    setBusy(true);
    await post("/api/focus", { action: "recalc", today }).catch(() => undefined);
    router.refresh();
    setBusy(false);
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 pt-5">
        <Link href="/" className="icon-btn" aria-label="Фокус режимінен шығу">
          <X size={19} />
        </Link>
        <div className="text-center text-xs text-ink-3">
          <div className="eyebrow">Odak Modu</div>
          {daysLeft > 0 ? `Емтиханға ${daysLeft} күн` : daysLeft === 0 ? "Емтихан бүгін" : "Емтихан өтті"}
        </div>
        <button
          className="icon-btn"
          aria-label="Жоспарды өзгерту"
          onClick={async () => {
            if (!confirm("Жаңа жоспар құру керек пе? Ағымдағы жоспар жабылады.")) return;
            await post("/api/focus", { action: "end" });
            router.refresh();
          }}
        >
          <Settings2 size={18} />
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-20 pt-10">
        {/* week strip */}
        <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
          {days.map((d) => {
            const dt = tasks.filter((t) => t.day === d);
            const dd = dt.filter((t) => t.done_at).length;
            const isToday = d === today;
            const date = new Date(d + "T00:00:00");
            return (
              <div key={d} className={`flex w-11 shrink-0 flex-col items-center gap-1.5 rounded-xl py-2 ${isToday ? "bg-surface ring-1 ring-line" : ""}`}>
                <span className="text-[0.65rem] text-ink-3">{DAY_KZ[date.getDay()]}</span>
                <span className={`text-sm tabular-nums ${isToday ? "font-semibold" : "text-ink-2"}`}>{date.getDate()}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${dd === dt.length && dt.length ? "bg-teal" : dd ? "bg-teal/40" : d < today ? "bg-line-2" : "bg-surface-2"}`} />
              </div>
            );
          })}
        </div>

        {missed.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border hairline bg-surface px-5 py-4 text-sm">
            <span className="text-ink-2">Өткен күндерден {missed.length} тапсырма қалды. Жоспарды қалған күндерге бөліп берейін бе?</span>
            <button className="btn btn-ghost h-9" onClick={recalc} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Қайта есептеу
            </button>
          </div>
        )}

        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h1 className="font-serif text-3xl">Бүгін</h1>
            <span className="text-sm tabular-nums text-ink-3">
              {doneToday}/{todays.length}
            </span>
          </div>
          <div className="progress-track mt-3">
            <div className="progress-fill" style={{ width: `${pct * 100}%` }} />
          </div>

          <AnimatePresence mode="wait">
            {current ? (
              <motion.div key={current.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="card mt-8 p-7">
                <div className="eyebrow">Қазіргі тапсырма · {current.minutes} мин</div>
                <div className="mt-3 font-serif text-[1.6rem] leading-snug">{current.title}</div>
                {current.kind === "vocab" && current.ref === "due" && <div className="mt-2 text-sm text-ink-3">Қайталауды күтетін сөздер: {due}</div>}
                {current.kind === "mistakes" && <div className="mt-2 text-sm text-ink-3">Түзетілмеген қателер: {mistakes}</div>}
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href={taskHref(current)} className="btn btn-primary h-11 px-6">
                    Бастау <ArrowRight size={16} />
                  </Link>
                  <button className="btn btn-ghost h-11" onClick={() => toggle(current)}>
                    <Check size={16} /> Орындалды
                  </button>
                </div>
              </motion.div>
            ) : todays.length ? (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 rounded-[14px] bg-teal-soft/70 p-8 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal text-white">
                  <Check size={22} />
                </div>
                <div className="mt-4 font-serif text-2xl">Бүгінгі жоспар орындалды</div>
                <p className="mt-2 text-sm text-ink-2">Жақсы жұмыс. Ертең жалғастырамыз — демалыс та оқудың бір бөлігі.</p>
              </motion.div>
            ) : (
              <div className="mt-8 rounded-[14px] border hairline p-8 text-center text-ink-2">Бүгінге тапсырма жоспарланбаған.</div>
            )}
          </AnimatePresence>

          {todays.length > 0 && (
            <ul className="mt-8 divide-y divide-[var(--line)] border-y hairline">
              {todays.map((t) => (
                <li key={t.id} className="flex items-center gap-4 py-3.5">
                  <button
                    onClick={() => toggle(t)}
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors ${t.done_at ? "border-teal bg-teal text-white" : "border-line-2 hover:border-teal"}`}
                    aria-label={t.done_at ? "Орындалмады деп белгілеу" : "Орындалды деп белгілеу"}
                    aria-pressed={!!t.done_at}
                  >
                    {t.done_at && <Check size={13} />}
                  </button>
                  <Link href={taskHref(t)} className={`flex-1 text-[0.95rem] ${t.done_at ? "text-ink-3 line-through decoration-line-2" : "hover:text-teal"}`}>
                    {t.title}
                  </Link>
                  <span className="text-xs tabular-nums text-ink-3">{t.minutes} мин</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <WeakAreas units={units} />
      </main>
    </div>
  );
}

function WeakAreas({ units }: { units: UnitStatus[] }) {
  const weak = useMemo(() => units.filter((u) => u.accuracy !== null && u.accuracy < 0.7).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)), [units]);
  const unread = units.filter((u) => u.pagesDone / u.pagesTotal < 0.5);
  if (!weak.length && !unread.length) return null;
  return (
    <section className="mt-14">
      <div className="eyebrow">Назар аударатын жерлер</div>
      <ul className="mt-4 space-y-2 text-sm">
        {weak.map((u) => (
          <li key={u.unit} className="flex items-center justify-between gap-3">
            <span>
              {u.unit}. {UNIT_TR[u.unit]} — жаттығу дәлдігі {Math.round((u.accuracy ?? 0) * 100)}%
            </span>
            <Link href={`/pratik/${u.unit}/gramer`} className="text-teal hover:underline">
              Жаттығу
            </Link>
          </li>
        ))}
        {unread.slice(0, 4).map((u) => (
          <li key={`r${u.unit}`} className="flex items-center justify-between gap-3 text-ink-2">
            <span>
              {u.unit}. {UNIT_TR[u.unit]} — {u.pagesDone}/{u.pagesTotal} бет оқылды
            </span>
            <Link href={`/kitap/${u.from}`} className="text-teal hover:underline">
              Оқу
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Setup({ units }: { units: UnitStatus[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"7" | "14" | "21" | "custom">("14");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = units.reduce((s, u) => s + u.pagesDone, 0);
  const total = units.reduce((s, u) => s + u.pagesTotal, 0);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await post("/api/focus", { action: "create", today: localToday(), mode, examDate: mode === "custom" ? date : undefined });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Қате");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center px-5 pt-5">
        <Link href="/" className="icon-btn" aria-label="Шығу">
          <X size={19} />
        </Link>
      </header>
      <main className="mx-auto max-w-xl px-5 pb-20 pt-12">
        <div className="eyebrow">Odak Modu</div>
        <h1 className="mt-3 font-serif text-4xl leading-tight" style={{ fontWeight: 460 }}>
          Емтиханға дейін нақты жоспар
        </h1>
        <p className="mt-4 text-ink-2">
          Күнделікті тапсырмалар: кітап беттері, сөздер, төрт дағды және сынақ емтихандары. Прогресіңізге қарай әлсіз тараулар бірінші тұрады. Күн өткізіп алсаңыз, жоспар қайта есептеледі.
        </p>
        <div className="mt-6 text-sm text-ink-3">
          Қазіргі прогресс: {done}/{total} сабақ беті аяқталған
        </div>

        <div className="mt-10 grid grid-cols-3 gap-2">
          {(
            [
              ["7", "7 күн", "Қарқынды"],
              ["14", "14 күн", "Жүйелі"],
              ["21", "21 күн", "Толық"],
            ] as const
          ).map(([m, label, sub]) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-[14px] border p-4 text-left transition-colors ${mode === m ? "border-teal bg-teal-soft" : "border-line bg-surface hover:border-line-2"}`} aria-pressed={mode === m}>
              <div className="font-serif text-xl">{label}</div>
              <div className="text-xs text-ink-3">{sub}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setMode("custom")} className={`mt-2 w-full rounded-[14px] border p-4 text-left transition-colors ${mode === "custom" ? "border-teal bg-teal-soft" : "border-line bg-surface hover:border-line-2"}`} aria-pressed={mode === "custom"}>
          <div className="font-medium">Емтихан күні бойынша</div>
          {mode === "custom" && <input type="date" className="input mt-3" value={date} min={localToday()} onChange={(e) => setDate(e.target.value)} aria-label="Емтихан күні" />}
        </button>
        {error && <p className="mt-4 text-sm text-rose">{error}</p>}
        <button className="btn btn-primary mt-8 h-12 w-full" onClick={create} disabled={busy || (mode === "custom" && !date)}>
          {busy && <Loader2 size={16} className="animate-spin" />} Жоспар құру
        </button>
      </main>
    </div>
  );
}
