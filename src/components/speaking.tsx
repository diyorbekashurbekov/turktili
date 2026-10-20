"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flag, GraduationCap, Keyboard, Loader2, MessagesSquare, Mic, MicOff, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { speak, stopSpeaking, sttSupported, useRecognizer } from "@/lib/speech";
import { Rubric } from "./writing";

type Msg = { role: "user" | "assistant"; content: string; note?: string };
export type SpeakingMode = "ogretmen" | "sohbet";
export type SpeakingFeedback = {
  summary_kz: string;
  corrections: { said: string; better: string; explanation_kz: string }[];
  strengths_kz: string[];
  next_steps_kz: string[];
  rubric: { task: number; grammar: number; vocabulary: number; interaction: number };
  pronunciation_note_kz: string;
};

type TurnResponse = { transcript?: string; reply: string; speakText?: string; explanation?: string; sessionId: number; empty?: boolean; error?: string };

const MODES: Record<SpeakingMode, { tr: string; kz: string; hint: string; icon: typeof Mic }> = {
  ogretmen: { tr: "Öğretmen", kz: "Мұғалім", hint: "Сұрақ қояды, қатені түзетеді, қиын жерін қазақша түсіндіреді.", icon: GraduationCap },
  sohbet: { tr: "Sohbet", kz: "Әңгіме", hint: "Еркін әңгіме. Үзбейді — кері байланыс соңында беріледі.", icon: MessagesSquare },
};

/** Subtle live level bars for the microphone / speaking states. */
function Bars({ level, active, tone = "teal" }: { level: number; active: boolean; tone?: "teal" | "ink" }) {
  return (
    <div className="flex h-5 items-center gap-[3px]" aria-hidden>
      {[0.6, 1, 0.75, 0.9, 0.55].map((k, i) => (
        <motion.span
          key={i}
          className={`w-[3px] rounded-full ${tone === "teal" ? "bg-teal" : "bg-ink-3"}`}
          animate={{ height: active ? `${Math.max(18, Math.min(100, (level * 100 + 25) * k))}%` : "18%" }}
          transition={{ duration: 0.12 }}
        />
      ))}
    </div>
  );
}

function SpeakingDots() {
  return (
    <div className="flex h-5 items-center gap-[3px]" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span key={i} className="w-[3px] rounded-full bg-teal" animate={{ height: ["25%", "90%", "25%"] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }} />
      ))}
    </div>
  );
}

export function SpeakingSession({
  topic,
  questions,
  aiReady,
  examMode = false,
  maxTurns,
  defaultMode = "ogretmen",
  onFinish,
}: {
  topic: { tr: string; kz: string };
  questions: string[];
  aiReady: boolean;
  examMode?: boolean;
  maxTurns?: number;
  defaultMode?: SpeakingMode;
  onFinish?: (r: { sessionId: number | null; feedback: SpeakingFeedback | null; messages: Msg[] }) => void;
}) {
  const [mode, setMode] = useState<SpeakingMode>(defaultMode);
  const storeKey = `yi-speak2-${topic.tr}-${examMode ? "exam" : mode}`;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [handsFree, setHandsFree] = useState(true);
  const [micOk, setMicOk] = useState(true);
  const rec = useRecognizer("tr-TR");
  const listRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Msg[]>([]);
  const started = messages.length > 0;
  const userTurns = messages.filter((m) => m.role === "user").length;
  historyRef.current = messages;

  useEffect(() => {
    setMicOk(sttSupported());
    if (!sttSupported()) setTextMode(true);
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) || "null");
      if (saved?.messages?.length && !examMode) {
        setMessages(saved.messages);
        setSessionId(saved.sessionId ?? null);
      } else {
        setMessages([]);
        setSessionId(null);
      }
    } catch {
      /* ignore */
    }
    return () => stopSpeaking();
  }, [storeKey, examMode]);

  // remember the chosen mode per topic, so a reload returns to the same conversation
  useEffect(() => {
    try {
      const m = sessionStorage.getItem(`yi-speak-mode-${topic.tr}`);
      if (!examMode && (m === "ogretmen" || m === "sohbet")) setMode(m);
    } catch {
      /* ignore */
    }
  }, [topic.tr, examMode]);
  useEffect(() => {
    try {
      sessionStorage.setItem(`yi-speak-mode-${topic.tr}`, mode);
    } catch {
      /* ignore */
    }
  }, [mode, topic.tr]);

  // no microphone permission / device: continue the conversation by typing
  useEffect(() => {
    if (rec.state === "denied" || rec.state === "unsupported") setTextMode(true);
  }, [rec.state]);

  useEffect(() => {
    try {
      if (!feedback) sessionStorage.setItem(storeKey, JSON.stringify({ messages, sessionId }));
    } catch {
      /* ignore */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sessionId, storeKey, feedback]);

  const wire = (history: Msg[]) => history.map(({ role, content }) => ({ role, content }));

  /** Plays the Turkish part of a reply; in Sohbet with hands-free on, listens again afterwards. */
  const voice = (text: string, then?: () => void) => {
    if (!text) return then?.();
    setAiSpeaking(true);
    speak(text, {
      onEnd: () => {
        setAiSpeaking(false);
        then?.();
      },
      onError: () => setAiSpeaking(false),
    });
  };

  const autoListen = () => {
    if (mode === "sohbet" && handsFree && !textMode && !examMode) listen();
  };

  function applyTurn(d: TurnResponse, base: Msg[]) {
    const next: Msg[] = d.transcript ? [...base, { role: "user", content: d.transcript }] : [...base];
    next.push({ role: "assistant", content: d.reply, note: d.explanation });
    setMessages(next);
    setSessionId(d.sessionId);
    const reachedMax = maxTurns && next.filter((m) => m.role === "user").length >= maxTurns;
    voice(d.speakText ?? d.reply, reachedMax ? () => finish(next, d.sessionId) : autoListen);
  }

  async function textTurn(history: Msg[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.tr, questions, messages: wire(history), sessionId, examMode, mode }),
      });
      const d = (await res.json()) as TurnResponse;
      if (!res.ok) throw new Error(d.error || "AI жауап бермеді.");
      applyTurn(d, history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Қате");
    } finally {
      setBusy(false);
    }
  }

  async function audioTurn(blob: Blob) {
    setBusy(true);
    setError(null);
    const base = historyRef.current;
    try {
      const fd = new FormData();
      fd.append("audio", blob, "speech");
      fd.append("meta", JSON.stringify({ topic: topic.tr, questions, messages: wire(base), sessionId, examMode, mode }));
      const res = await fetch("/api/ai/speak", { method: "POST", body: fd });
      const d = (await res.json()) as TurnResponse;
      if (!res.ok) throw new Error(d.error || "AI жауап бермеді.");
      if (d.empty) {
        setError("Дауыс естілмеді. Микрофонға жақынырақ сөйлеп көріңіз.");
        rec.setState("idle");
        return;
      }
      rec.setState("idle");
      applyTurn(d, base);
    } catch (e) {
      rec.setState("idle");
      setError(e instanceof Error ? e.message : "Қате");
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    stopSpeaking();
    setAiSpeaking(false);
    setError(null);
    rec.startRaw((blob) => {
      rec.setState("processing");
      audioTurn(blob);
    });
  }

  async function finish(history = historyRef.current, sid = sessionId) {
    stopSpeaking();
    rec.stop();
    if (!history.some((m) => m.role === "user")) {
      onFinish?.({ sessionId: sid, feedback: null, messages: history });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ai/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.tr, questions, messages: wire(history), finish: true, sessionId: sid, examMode, mode }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setFeedback(d.feedback);
      sessionStorage.removeItem(storeKey);
      onFinish?.({ sessionId: sid, feedback: d.feedback, messages: history });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Қате");
      onFinish?.({ sessionId: sid, feedback: null, messages: history });
    } finally {
      setBusy(false);
    }
  }

  const answerText = (text: string) => {
    if (!text.trim()) return;
    const next: Msg[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setDraft("");
    textTurn(next);
  };

  const lastAi = [...messages].reverse().find((m) => m.role === "assistant");
  const listening = rec.state === "listening";
  const processing = rec.state === "processing" || (busy && started);

  if (!aiReady)
    return (
      <div className="card p-6">
        <div className="font-serif text-xl">AI сөйлеу серіктесі</div>
        <p className="mt-2 text-sm text-amber">AI әлі қосылмаған (серверде GEMINI_API_KEY жоқ). Төмендегі сұрақтарға дауыстап жауап беріп жаттығыңыз:</p>
        <ol className="mt-4 space-y-2">
          {questions.map((qq, i) => (
            <li key={i} className="flex items-center gap-3">
              <button className="icon-btn h-8 w-8" onClick={() => speak(qq)} aria-label="Тыңдау">
                <Volume2 size={15} />
              </button>
              {qq}
            </li>
          ))}
        </ol>
      </div>
    );

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b hairline px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="font-serif text-lg">{topic.tr}</div>
          <div className="text-xs text-ink-3">
            {topic.kz} · {examMode ? "Сынақ ауызша емтихан" : `${MODES[mode].tr} режимі`}
          </div>
        </div>
        <MicStatus state={rec.state} supported={micOk} />
        {micOk && (
          <button className="icon-btn" onClick={() => setTextMode((v) => !v)} aria-pressed={textMode} aria-label="Мәтінмен жауап беру" title="Дауыс / мәтін">
            <Keyboard size={17} />
          </button>
        )}
      </div>

      {!examMode && !started && (
        <div className="grid grid-cols-2 gap-2 px-5 pt-5" role="radiogroup" aria-label="Сөйлеу режимі">
          {(Object.keys(MODES) as SpeakingMode[]).map((m) => {
            const M = MODES[m];
            return (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-[14px] border p-4 text-left transition-colors ${mode === m ? "border-teal bg-teal-soft" : "border-line bg-bg hover:border-line-2"}`}
              >
                <div className="flex items-center gap-2">
                  <M.icon size={16} className="text-teal" />
                  <span className="font-medium">{M.tr}</span>
                  <span className="hidden text-xs text-ink-3 sm:inline">· {M.kz}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{M.hint}</p>
              </button>
            );
          })}
        </div>
      )}

      <div ref={listRef} className="max-h-[50vh] min-h-[220px] space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
        {!started && (
          <div className="py-6 text-center">
            <p className="mx-auto max-w-sm text-sm text-ink-2">
              {examMode
                ? "Емтихан алушы түрікше сұрақтар қояды. Микрофонмен жауап беріңіз."
                : mode === "sohbet"
                  ? "Түрік досыңызбен сөйлескендей еркін сөйлесіңіз. Қолсыз режимде ол сөйлеп болған соң микрофон өзі қосылады."
                  : "Мұғалім түрікше сұрақ қояды. Жауап беріңіз — қатеңізді түзетіп, қиын жерін қазақша түсіндіреді."}
            </p>
            <button className="btn btn-teal mt-6 h-12 px-6" onClick={() => textTurn([])} disabled={busy}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />} Сөйлесуді бастау
            </button>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
              <button className="icon-btn mt-0.5 h-8 w-8 shrink-0" onClick={() => voice(m.content.split(/(?=Түсіндірме)/)[0])} aria-label="Қайта тыңдау">
                <Volume2 size={15} />
              </button>
              <div className="min-w-0">
                <p className="text-[1.02rem] leading-relaxed">{m.note ? m.content.replace(m.note, "").replace(/Түсіндірме:?\s*$/, "").trim() : m.content}</p>
                {m.note && <p className="mt-1.5 rounded-lg bg-teal-soft/60 px-3 py-2 text-sm text-teal-ink">{m.note.replace(/^Түсіндірме:\s*/, "")}</p>}
              </div>
            </motion.div>
          ) : (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-[0.95rem]">
              {m.content}
            </motion.div>
          ),
        )}
        {processing && (
          <div className="flex items-center gap-2 text-sm text-ink-3">
            <Loader2 size={15} className="animate-spin text-teal" /> {rec.state === "processing" ? "Тыңдап, жауап дайындап жатыр…" : "Жауап дайындалуда…"}
          </div>
        )}
        {error && <div className="rounded-xl bg-rose-soft px-4 py-3 text-sm text-rose">{error}</div>}
      </div>

      {started && !feedback && (
        <div className="border-t hairline px-5 py-4">
          {textMode ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                answerText(draft);
              }}
            >
              <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Türkçe cevap yazın…" disabled={busy} aria-label="Жауап" />
              <button className="btn btn-teal" disabled={busy || !draft.trim()}>
                Жіберу
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-5">
              <button className="icon-btn" onClick={() => lastAi && voice(lastAi.content.split(/(?=Түсіндірме)/)[0])} disabled={!lastAi || busy} aria-label="Сұрақты қайталау" title="Сұрақты қайталау">
                <RotateCcw size={18} />
              </button>
              <div className="relative grid place-items-center">
                {listening && <motion.span className="absolute rounded-full bg-teal/15" animate={{ width: 64 + rec.level * 60, height: 64 + rec.level * 60 }} transition={{ duration: 0.1 }} aria-hidden />}
                <button
                  className={`relative grid h-16 w-16 place-items-center rounded-full text-white transition-colors ${listening ? "bg-rose" : "bg-teal hover:bg-teal-ink"} disabled:opacity-40`}
                  disabled={processing}
                  onClick={() => (listening ? rec.stop() : listen())}
                  aria-label={listening ? "Жауапты аяқтау" : "Жауап беру"}
                >
                  {listening ? <Square size={20} /> : <Mic size={24} />}
                </button>
              </div>
              <div className="flex w-10 justify-center">{aiSpeaking ? <SpeakingDots /> : <Bars level={rec.level} active={listening} />}</div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
            <span>
              {aiSpeaking ? "Мұғалім сөйлеп тұр — бөлу үшін микрофонды басыңыз" : listening ? "Тыңдап тұр… сөйлеп болғанда тоқтайды" : `${userTurns} жауап${maxTurns ? ` / ${maxTurns}` : ""}`}
            </span>
            {mode === "sohbet" && !examMode && !textMode && (
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={handsFree} onChange={(e) => setHandsFree(e.target.checked)} className="accent-[var(--teal)]" /> Қолсыз режим
              </label>
            )}
            <button className="inline-flex items-center gap-1.5 hover:text-ink" onClick={() => finish()} disabled={busy}>
              <Flag size={13} /> Аяқтау және кері байланыс алу
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {feedback && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 border-t hairline px-5 py-6">
            <div className="rounded-xl bg-teal-soft/60 p-4 text-[0.95rem] leading-relaxed">{feedback.summary_kz}</div>
            {feedback.corrections.length > 0 && (
              <div>
                <div className="eyebrow mb-2">Түзетулер</div>
                <ul className="divide-y divide-[var(--line)] rounded-xl border hairline">
                  {feedback.corrections.map((c, i) => (
                    <li key={i} className="p-4">
                      <div className="flex flex-wrap items-center gap-2 text-[0.95rem]">
                        <span className="text-rose">{c.said}</span> <span className="text-ink-3">→</span> <span className="font-medium text-green">{c.better}</span>
                        <button className="icon-btn ml-auto h-8 w-8" onClick={() => speak(c.better)} aria-label="Дұрысын тыңдау">
                          <Volume2 size={14} />
                        </button>
                      </div>
                      <p className="mt-1 text-sm text-ink-2">{c.explanation_kz}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Rubric r={feedback.rubric} labels={{ task: "Тапсырма", grammar: "Грамматика", vocabulary: "Сөздік", interaction: "Қарым-қатынас" }} />
            <div className="rounded-xl border hairline bg-bg p-4 text-sm text-ink-2">
              <div className="mb-1 font-medium text-ink">Айтылым туралы</div>
              {feedback.pronunciation_note_kz}
              <div className="mt-1 text-xs text-ink-3">Айтылым акустикалық түрде бағаланбайды — кері байланыс сөйлеуді тану мәтініне негізделген.</div>
            </div>
            {!examMode && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setFeedback(null);
                  setMessages([]);
                  setSessionId(null);
                }}
              >
                Жаңа сөйлесу
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MicStatus({ state, supported }: { state: string; supported: boolean }) {
  if (!supported)
    return (
      <span className="chip text-amber" title="Бұл браузерде микрофон жазу жоқ — мәтінмен жауап беріңіз">
        <MicOff size={13} /> Микрофон қолжетімсіз
      </span>
    );
  if (state === "denied")
    return (
      <span className="chip border-rose/30 text-rose" title="Браузердің мекенжай жолағындағы құлып белгісінен микрофонға рұқсат беріңіз">
        <MicOff size={13} /> Микрофонға рұқсат жоқ
      </span>
    );
  if (state === "listening")
    return (
      <span className="chip border-rose/30 text-rose">
        <span className="h-2 w-2 animate-pulse rounded-full bg-rose" /> Тыңдап тұр
      </span>
    );
  if (state === "processing")
    return (
      <span className="chip">
        <Loader2 size={13} className="animate-spin" /> Өңделуде
      </span>
    );
  return (
    <span className="chip">
      <Mic size={13} /> Дайын
    </span>
  );
}
