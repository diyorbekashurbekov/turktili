"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { post } from "@/lib/client";
import type { PageBlock } from "@/content/types";

function useSave() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "ok" | string>("idle");
  const save = async (body: unknown) => {
    setState("busy");
    try {
      await post("/api/admin", body);
      setState("ok");
      router.refresh();
    } catch (e) {
      setState(e instanceof Error ? e.message : "Қате");
    }
  };
  return { state, save };
}

function Status({ state }: { state: string }) {
  if (state === "busy") return <Loader2 size={15} className="animate-spin text-ink-3" />;
  if (state === "ok") return <span className="text-sm text-green">Сақталды</span>;
  if (state !== "idle") return <span className="text-sm text-rose">{state}</span>;
  return null;
}

export function AdminSettings({
  settings,
  textModels,
  ttsModels,
}: {
  settings: { aiEnabled: boolean; textModel: string; ttsModel: string; ttsDailyPerUser: number; dailyBudgetUsd: number; guestDailyRequests: number; memberDailyRequests: number; pageImagesAuthorized: boolean };
  textModels: string[];
  ttsModels: string[];
}) {
  const [s, setS] = useState(settings);
  const { state, save } = useSave();
  return (
    <form
      className="card grid gap-5 p-6 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        save({ action: "settings", ...s });
      }}
    >
      <label className="flex items-center gap-3 sm:col-span-2">
        <input type="checkbox" checked={s.aiEnabled} onChange={(e) => setS({ ...s, aiEnabled: e.target.checked })} className="h-4 w-4 accent-[var(--teal)]" />
        <span>AI функциялары қосулы (апаттық өшіргіш)</span>
      </label>
      <label className="block">
        <span className="text-xs text-ink-3">Мұғалім моделі (мәтін, аудио түсіну)</span>
        <select className="input mt-1" value={s.textModel} onChange={(e) => setS({ ...s, textModel: e.target.value })}>
          {textModels.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-ink-3">Түрікше дыбыс моделі (TTS)</span>
        <select className="input mt-1" value={s.ttsModel} onChange={(e) => setS({ ...s, ttsModel: e.target.value })}>
          {ttsModels.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-ink-3">Бір студентке күніне жаңа дыбыс (кэштен тыс)</span>
        <input className="input mt-1" type="number" min={0} value={s.ttsDailyPerUser} onChange={(e) => setS({ ...s, ttsDailyPerUser: +e.target.value })} />
      </label>
      <label className="block">
        <span className="text-xs text-ink-3">Күндік жалпы бюджет, $</span>
        <input className="input mt-1" type="number" step="0.5" min={0} value={s.dailyBudgetUsd} onChange={(e) => setS({ ...s, dailyBudgetUsd: +e.target.value })} />
      </label>
      <label className="block">
        <span className="text-xs text-ink-3">Қонақтың күндік сұрау лимиті</span>
        <input className="input mt-1" type="number" min={0} value={s.guestDailyRequests} onChange={(e) => setS({ ...s, guestDailyRequests: +e.target.value })} />
      </label>
      <label className="block">
        <span className="text-xs text-ink-3">Тіркелген студенттің күндік лимиті</span>
        <input className="input mt-1" type="number" min={0} value={s.memberDailyRequests} onChange={(e) => setS({ ...s, memberDailyRequests: +e.target.value })} />
      </label>
      <label className="flex items-start gap-3 sm:col-span-2">
        <input type="checkbox" checked={s.pageImagesAuthorized} onChange={(e) => setS({ ...s, pageImagesAuthorized: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--teal)]" />
        <span>
          Түпнұсқа бет суреттерін көрсетуге құқық бар (BOOK_PAGES_DIR)
          <span className="block text-xs text-ink-3">Тек баспагердің рұқсаты болса ғана қосыңыз. Суреттер жабық API арқылы беріледі.</span>
        </span>
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn btn-primary">Сақтау</button>
        <Status state={state} />
      </div>
    </form>
  );
}

type Exam = {
  readingQuestions: number;
  listeningQuestions: number;
  grammarQuestions: number;
  vocabQuestions: number;
  writingTasks: number;
  speakingQuestions: number;
  minutes: { okuma: number; dinleme: number; yazma: number; konusma: number; full: number };
};

export function ExamSettings({ exam }: { exam: Exam }) {
  const [e, setE] = useState(exam);
  const { state, save } = useSave();
  const num = (k: keyof Omit<Exam, "minutes">, label: string) => (
    <label className="block">
      <span className="text-xs text-ink-3">{label}</span>
      <input className="input mt-1" type="number" min={1} value={e[k]} onChange={(x) => setE({ ...e, [k]: +x.target.value })} />
    </label>
  );
  const min = (k: keyof Exam["minutes"], label: string) => (
    <label className="block">
      <span className="text-xs text-ink-3">{label}, мин</span>
      <input className="input mt-1" type="number" min={1} value={e.minutes[k]} onChange={(x) => setE({ ...e, minutes: { ...e.minutes, [k]: +x.target.value } })} />
    </label>
  );
  return (
    <form
      className="card max-w-3xl space-y-6 p-6"
      onSubmit={(x) => {
        x.preventDefault();
        save({ action: "exam", exam: e });
      }}
    >
      <p className="text-sm text-ink-2">Ресми емтихан форматы берілмеген — бұл жаттығу емтихандарының құрылымы. Университет форматына сай өзгертіңіз.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {num("readingQuestions", "Оқу сұрақтары")}
        {num("listeningQuestions", "Тыңдау сұрақтары")}
        {num("grammarQuestions", "Грамматика сұрақтары")}
        {num("vocabQuestions", "Сөздік сұрақтары")}
        {num("speakingQuestions", "Ауызша сұрақтар")}
        {num("writingTasks", "Жазу тапсырмалары")}
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        {min("okuma", "Оқу")}
        {min("dinleme", "Тыңдау")}
        {min("yazma", "Жазу")}
        {min("konusma", "Сөйлеу")}
        {min("full", "Толық")}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary">Сақтау</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function PageEditor({
  page,
  overrides,
}: {
  page: { n: number; title: string; blocks: PageBlock[]; answers: { label: string; text: string; confidence: string }[] };
  overrides: { field: string; updated_at: string; updated_by: string | null }[];
}) {
  const router = useRouter();
  const [n, setN] = useState(String(page.n));
  const [title, setTitle] = useState(page.title);
  const [blocks, setBlocks] = useState(page.blocks.map((b) => b.text));
  const { state, save } = useSave();
  return (
    <div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/admin?tab=icerik&page=${n}`);
        }}
      >
        <input className="input w-24" value={n} onChange={(e) => setN(e.target.value)} inputMode="numeric" aria-label="Бет" />
        <button className="btn btn-ghost">Ашу</button>
        <a href={`/kitap/${page.n}`} className="ml-auto text-sm text-teal hover:underline">
          Беттегі көрінісі →
        </a>
      </form>
      {overrides.length > 0 && (
        <div className="mt-4 rounded-xl bg-amber-soft px-4 py-3 text-xs text-amber">
          Түзетілген өрістер: {overrides.map((o) => `${o.field} (${o.updated_by ?? "?"}, ${o.updated_at})`).join("; ")}
        </div>
      )}
      <label className="mt-6 block">
        <span className="text-xs text-ink-3">Тақырып</span>
        <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <button className="btn btn-ghost mt-2 h-8 text-xs" onClick={() => save({ action: "page-override", page: page.n, field: "title", value: title })}>
        Тақырыпты сақтау
      </button>
      {page.blocks.map((b, i) => (
        <div key={i} className="mt-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-3">
              {b.label || "Мазмұн"} · {b.kind}
            </span>
            <div className="flex gap-2">
              {overrides.some((o) => o.field === `block:${i}`) && (
                <button className="btn btn-quiet h-8 text-xs" onClick={() => save({ action: "page-override-clear", page: page.n, field: `block:${i}` })}>
                  Түпнұсқаға қайтару
                </button>
              )}
              <button className="btn btn-ghost h-8 text-xs" onClick={() => save({ action: "page-override", page: page.n, field: `block:${i}`, value: blocks[i] })}>
                Сақтау
              </button>
            </div>
          </div>
          <textarea className="input mt-1 font-mono text-xs" rows={Math.min(18, Math.max(4, b.text.split("\n").length + 1))} value={blocks[i]} onChange={(e) => setBlocks((bs) => bs.map((x, k) => (k === i ? e.target.value : x)))} />
        </div>
      ))}
      <div className="mt-4">
        <Status state={state} />
      </div>
    </div>
  );
}

export function VocabEditor({ term, words }: { term: string; words: { id: string; tr: string; kz: string; page: number }[] }) {
  const router = useRouter();
  const [t, setT] = useState(term);
  return (
    <div>
      <h2 className="font-serif text-xl">Сөздікті түзету</h2>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/admin?tab=icerik&w=${encodeURIComponent(t)}`);
        }}
      >
        <input className="input" value={t} onChange={(e) => setT(e.target.value)} placeholder="Сөз іздеу…" />
        <button className="btn btn-ghost">Іздеу</button>
      </form>
      <ul className="mt-4 space-y-2">
        {words.map((w) => (
          <WordRow key={w.id} w={w} />
        ))}
      </ul>
    </div>
  );
}

function WordRow({ w }: { w: { id: string; tr: string; kz: string; page: number } }) {
  const [tr, setTr] = useState(w.tr);
  const [kz, setKz] = useState(w.kz);
  const { state, save } = useSave();
  return (
    <li className="rounded-xl border hairline bg-surface p-3">
      <div className="text-xs text-ink-3">
        {w.id} · {w.page}-бет
      </div>
      <input className="input mt-1 h-9" value={tr} onChange={(e) => setTr(e.target.value)} />
      <input className="input mt-1 h-9" value={kz} onChange={(e) => setKz(e.target.value)} />
      <div className="mt-2 flex items-center gap-2">
        <button className="btn btn-ghost h-8 text-xs" onClick={() => save({ action: "vocab-override", wordId: w.id, tr, kz })}>
          Сақтау
        </button>
        <Status state={state} />
      </div>
    </li>
  );
}

export function UserRow({ user }: { user: { id: string; email: string | null; name: string | null; role: string; disabled: number; created_at: string; pages: number } }) {
  const { state, save } = useSave();
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      <span className="min-w-0 flex-1">
        <span className="font-medium">{user.name}</span> <span className="text-ink-3">{user.email}</span>
        <span className="block text-xs text-ink-3">
          {user.created_at.slice(0, 10)} · {user.pages} бет · {user.role}
        </span>
      </span>
      <button className="btn btn-ghost h-8 text-xs" onClick={() => save({ action: "user", userId: user.id, role: user.role === "admin" ? "student" : "admin" })}>
        {user.role === "admin" ? "Әкімшіліктен алу" : "Әкімші ету"}
      </button>
      <button className="btn btn-ghost h-8 text-xs" onClick={() => save({ action: "user", userId: user.id, disabled: !user.disabled })}>
        {user.disabled ? "Қосу" : "Бұғаттау"}
      </button>
      <Status state={state} />
    </li>
  );
}

export function AudioUpload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="card space-y-3 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const fd = new FormData(e.currentTarget);
        const res = await fetch("/api/admin", { method: "POST", body: fd });
        const d = await res.json().catch(() => ({}));
        setBusy(false);
        setMsg(res.ok ? "Жүктелді" : d.error || "Қате");
        if (res.ok) {
          (e.target as HTMLFormElement).reset();
          router.refresh();
        }
      }}
    >
      <h2 className="font-serif text-xl">Түпнұсқа аудио жүктеу</h2>
      <p className="text-xs text-ink-3">Тек құқығы бар кітап аудиосын жүктеңіз. Аудио тиісті беттің «Сабақ» бөлімінде «Түпнұсқа аудио» деп көрсетіледі.</p>
      <input className="input" name="page" type="number" min={1} max={192} placeholder="Бет нөмірі" required />
      <input className="input" name="title" placeholder="Атауы (мыс. 1-тапсырма, «Merhaba»)" required />
      <input className="block w-full text-sm" name="file" type="file" accept=".mp3,.m4a,.ogg,.wav" required />
      <button className="btn btn-primary" disabled={busy}>
        {busy && <Loader2 size={15} className="animate-spin" />} Жүктеу
      </button>
      {msg && <p className="text-sm text-ink-2">{msg}</p>}
    </form>
  );
}

export function AudioDelete({ id }: { id: number }) {
  const { save } = useSave();
  return (
    <button className="btn btn-quiet h-8 text-xs text-rose" onClick={() => confirm("Аудионы өшіру керек пе?") && save({ action: "audio-delete", id })}>
      Өшіру
    </button>
  );
}

export function ClearErrors() {
  const { save } = useSave();
  return (
    <button className="btn btn-ghost h-9" onClick={() => save({ action: "errors-clear" })}>
      Журналды тазалау
    </button>
  );
}
