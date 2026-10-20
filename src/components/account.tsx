"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { post, track } from "@/lib/client";

export function AuthForms() {
  const router = useRouter();
  const [tab, setTab] = useState<"register" | "login">("register");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth", tab === "register" ? { action: "register", ...form } : { action: "login", email: form.email, password: form.password });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Қате");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-6">
      <div className="mb-5 flex gap-5 border-b hairline text-sm" role="tablist">
        {(
          [
            ["register", "Тіркелу"],
            ["login", "Кіру"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 pb-3 ${tab === k ? "border-teal text-ink" : "border-transparent text-ink-3"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {tab === "register" && (
          <label className="block">
            <span className="text-xs text-ink-3">Атыңыз</span>
            <input className="input mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
          </label>
        )}
        <label className="block">
          <span className="text-xs text-ink-3">Email</span>
          <input className="input mt-1" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        </label>
        <label className="block">
          <span className="text-xs text-ink-3">Құпиясөз {tab === "register" && "(кемінде 8 таңба)"}</span>
          <input
            className="input mt-1"
            type="password"
            required
            minLength={tab === "register" ? 8 : 1}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete={tab === "register" ? "new-password" : "current-password"}
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-rose">{error}</p>}
      <button className="btn btn-primary mt-5 h-11 w-full" disabled={busy}>
        {busy && <Loader2 size={15} className="animate-spin" />} {tab === "register" ? "Тіркелу" : "Кіру"}
      </button>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost h-9"
      onClick={async () => {
        await post("/api/auth", { action: "logout" });
        router.refresh();
      }}
    >
      Шығу
    </button>
  );
}

export function ProfileForm({ name, examDate }: { name: string; examDate: string | null }) {
  const router = useRouter();
  const [n, setN] = useState(name);
  const [d, setD] = useState(examDate ?? "");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="mt-4 grid max-w-lg gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        await track({ type: "prefs", name: n, examDate: d || null });
        setSaved(true);
        router.refresh();
      }}
    >
      <label className="block">
        <span className="text-xs text-ink-3">Аты</span>
        <input className="input mt-1" value={n} onChange={(e) => (setN(e.target.value), setSaved(false))} />
      </label>
      <label className="block">
        <span className="text-xs text-ink-3">Емтихан күні</span>
        <input className="input mt-1" type="date" value={d} onChange={(e) => (setD(e.target.value), setSaved(false))} />
      </label>
      <button className="btn btn-primary h-11">{saved ? "Сақталды" : "Сақтау"}</button>
    </form>
  );
}
