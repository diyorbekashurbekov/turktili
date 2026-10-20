"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, Square, Volume2, Sparkles } from "lucide-react";
import { Markdown } from "./markdown";
import { speak, stopSpeaking, useRecognizer } from "@/lib/speech";

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "free" | "explain" | "simpler" | "example" | "quiz" | "mistakes";

const QUICK: { mode: Mode; label: string; prompt: string; needsPage?: boolean }[] = [
  { mode: "explain", label: "Бетті түсіндір", prompt: "Осы бетті түсіндіріп берші.", needsPage: true },
  { mode: "simpler", label: "Қарапайымырақ", prompt: "Қарапайымырақ түсіндірші." },
  { mode: "example", label: "Мысал келтір", prompt: "Осы тақырыпқа мысал келтірші." },
  { mode: "quiz", label: "Білімімді тексер", prompt: "Осы бет бойынша білімімді тексерші.", needsPage: true },
  { mode: "mistakes", label: "Қателерім", prompt: "Жаттығудағы қателерімді түсіндірші." },
];

const STORE_KEY = "yi-chat-v1";

function loadHistory(): Msg[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Turkish-only part of a reply for read-aloud: lines/phrases written in Latin script. */
function turkishParts(text: string) {
  return text
    .replace(/[*_`#>|]/g, " ")
    .split(/\n|(?<=[.!?])\s+/)
    .filter((l) => /[a-zçğıöşü]/i.test(l) && !/[а-яәғқңөұүһі]/i.test(l))
    .join(" ");
}

export function AiChat({
  page,
  aiReady,
  compact = false,
  intro,
}: {
  page: number | null;
  aiReady: boolean;
  compact?: boolean;
  intro?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micLang, setMicLang] = useState<"kk-KZ" | "tr-TR">("tr-TR");
  const listRef = useRef<HTMLDivElement>(null);
  const rec = useRecognizer(micLang);

  useEffect(() => setMessages(loadHistory()), []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      /* storage unavailable */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string, mode: Mode = "free") {
    if (!text.trim() || busy) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: text.trim() }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, mode, messages: next.slice(-12) }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "AI жауап бере алмады.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      setMessages(next);
      setError(e instanceof Error ? e.message : "Қате");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className={`min-h-0 flex-1 overflow-y-auto ${compact ? "px-5" : "px-1"} py-4`} aria-live="polite">
        {messages.length === 0 && (
          <div className="py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-soft text-teal">
              <Sparkles size={18} />
            </div>
            <p className="mt-4 font-serif text-xl leading-snug">{intro ?? "Сұрағыңызды қазақша не түрікше жазыңыз."}</p>
            <p className="mt-2 text-sm text-ink-2">
              {page ? `Мұғалім ${page}-бетті көріп тұр — қай бет екенін айтудың қажеті жоқ.` : "Кітаптың кез келген бетін ашып, сол бет бойынша сұрауға болады."}
            </p>
          </div>
        )}
        <div className="space-y-5">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-[0.95rem]">
                {m.content}
              </div>
            ) : (
              <div key={i} className="group">
                {m.content ? (
                  <Markdown>{m.content}</Markdown>
                ) : (
                  <div className="flex gap-1.5 py-2" aria-label="Жазып жатыр">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" style={{ animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </div>
                )}
                {m.content && !busy && turkishParts(m.content) && (
                  <button className="mt-1 inline-flex items-center gap-1 text-xs text-ink-3 opacity-70 hover:text-teal group-hover:opacity-100" onClick={() => speak(turkishParts(m.content))}>
                    <Volume2 size={13} /> Түрікше бөлігін тыңдау
                  </button>
                )}
              </div>
            ),
          )}
        </div>
        {error && <div className="mt-4 rounded-xl bg-rose-soft px-4 py-3 text-sm text-rose">{error}</div>}
      </div>

      <div className={`${compact ? "px-4" : ""} border-t hairline pb-4 pt-3`}>
        {!aiReady ? (
          <div className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber">
            AI мұғалім әлі қосылмаған: серверде <code>GEMINI_API_KEY</code> орнатылмаған. Кітап, сөздер, оқу, тыңдау және грамматика жаттығулары толық жұмыс істейді.
          </div>
        ) : (
          <>
            <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1">
              {QUICK.filter((qk) => !qk.needsPage || page).map((qk) => (
                <button key={qk.mode} className="chip shrink-0 hover:border-teal hover:text-teal" disabled={busy} onClick={() => send(qk.prompt, qk.mode)}>
                  {qk.label}
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <div className="relative flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  placeholder="Сұрақ жазыңыз…"
                  className="input max-h-40 min-h-[2.75rem] resize-none pr-20"
                  aria-label="Мұғалімге сұрақ"
                />
                {rec.supported && (
                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      className="h-8 rounded-full px-2 text-[0.65rem] font-semibold text-ink-3 hover:text-ink"
                      onClick={() => setMicLang((l) => (l === "tr-TR" ? "kk-KZ" : "tr-TR"))}
                      title="Микрофон тілі"
                    >
                      {micLang === "tr-TR" ? "TR" : "KZ"}
                    </button>
                    <button
                      type="button"
                      className={`icon-btn h-8 w-8 ${rec.state === "listening" ? "recording bg-teal text-white hover:bg-teal-ink hover:text-white" : ""}`}
                      style={rec.state === "listening" ? { boxShadow: `0 0 0 ${2 + Math.round(rec.level * 8)}px color-mix(in oklab, var(--teal) 22%, transparent)` } : undefined}
                      disabled={rec.state === "processing"}
                      onClick={() => (rec.state === "listening" ? rec.stop() : (stopSpeaking(), rec.start((t) => setInput((v) => (v ? v + " " : "") + t))))}
                      aria-label={rec.state === "listening" ? "Жазуды тоқтату" : rec.state === "processing" ? "Мәтінге айналдырылуда" : "Дауыспен жазу"}
                    >
                      {rec.state === "listening" ? <Square size={13} /> : rec.state === "processing" ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
                    </button>
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-teal h-11 w-11 shrink-0 p-0" disabled={busy || !input.trim()} aria-label="Жіберу">
                <ArrowUp size={18} />
              </button>
            </form>
            {rec.state === "denied" && <p className="mt-2 text-xs text-rose">Микрофонға рұқсат берілмеген. Браузер баптауларынан рұқсат беріңіз.</p>}
            {rec.state === "listening" && <p className="mt-2 text-xs text-ink-3">Тыңдап тұр ({micLang === "tr-TR" ? "түрікше" : "қазақша"}) — сөйлеп болғанда өзі тоқтайды.</p>}
            {rec.error && rec.state === "error" && <p className="mt-2 text-xs text-rose">{rec.error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
