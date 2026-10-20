// Real Gemini integration tests (no mocks). Requires a running server with GEMINI_API_KEY.
//   npm run dev   then   npm run test:ai
// Each test calls the live API through the app's own routes and checks the actual output.
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3100";
let cookie = "";
let passed = 0;
const failures = [];
const timings = [];

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { ...(opts.headers || {}), cookie } });
  for (const c of res.headers.getSetCookie?.() ?? []) if (c.startsWith("yi_sid=")) cookie = c.split(";")[0];
  return res;
}
const json = (path, body) => req(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const hasCyrillic = (s) => /[Ѐ-ӿ]/.test(s);
const hasKazakh = (s) => /[әғқңөұүһі]/i.test(s);
const NUM = { 0: "sıfır", 1: "bir", 2: "iki", 3: "üç", 4: "dört", 5: "beş", 6: "altı", 7: "yedi", 8: "sekiz", 9: "dokuz", 10: "on" };
// transcribers may write numbers as digits; compare words, not formatting
const norm = (s) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/\b(\d{1,2})\b/g, (m) => NUM[m] ?? m)
    .replace(/[.,!?;:"'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    passed++;
    timings.push([name, Date.now() - t]);
    console.log(`  ✓ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n    ${e.message}`);
  }
}

async function tts(text, v = "f") {
  const t = Date.now();
  const r = await req(`/api/tts?t=${encodeURIComponent(text)}&v=${v}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, type: r.headers.get("content-type"), cache: r.headers.get("x-tts-cache"), buf, ms: Date.now() - t };
}
const wavSeconds = (b) => (b.length - 44) / (b.readUInt32LE(24) * 2);

async function transcribe(buf, lang = "tr-TR") {
  const fd = new FormData();
  fd.append("audio", new Blob([buf], { type: "audio/wav" }), "a.wav");
  fd.append("lang", lang);
  const r = await req("/api/ai/transcribe", { method: "POST", body: fd });
  return { status: r.status, ...(await r.json()) };
}

async function chat(page, text, mode = "free") {
  const r = await json("/api/ai/chat", { page, mode, messages: [{ role: "user", content: text }] });
  return { status: r.status, text: await r.text() };
}

console.log(`Real AI tests against ${BASE}`);
await req("/");
// a member account gets the member quota (guests are capped lower)
const reg = await json("/api/auth", { action: "register", email: `ai-test-${Date.now()}@yedi.test`, password: `t-${Math.random().toString(36).slice(2)}`, name: "AI Test" });
assert.equal(reg.status, 200, "test account registration");

const WORDS = ["ağabey", "Günaydın", "öğretmen", "Kahvaltıdan sonra okula gidiyorum.", "Bayramınız kutlu olsun!"];
for (const w of WORDS) {
  await step(`TTS "${w}": native tr-TR audio, cached, intelligible on round trip`, async () => {
    const a = await tts(w);
    assert.equal(a.status, 200, a.buf.toString().slice(0, 200));
    assert.equal(a.type, "audio/wav");
    const secs = wavSeconds(a.buf);
    assert.ok(secs > 0.25 && secs < 12, `duration ${secs}s`);
    const b = await tts(w);
    assert.equal(b.cache, "hit", "second request must come from the cache");
    assert.ok(b.buf.equals(a.buf));
    const heard = await transcribe(a.buf);
    assert.equal(heard.status, 200);
    assert.equal(norm(heard.text), norm(w), `round trip heard "${heard.text}"`);
    console.log(`      ${secs.toFixed(2)}s audio · first ${a.ms} ms (${a.cache}) · cached ${b.ms} ms · heard "${heard.text}"`);
  });
}

await step("TTS male voice for a second dialogue speaker", async () => {
  const a = await tts("Patatesin kilosu sekiz lira.", "m");
  assert.equal(a.status, 200);
  const heard = await transcribe(a.buf);
  assert.equal(norm(heard.text), norm("Patatesin kilosu sekiz lira."));
});

await step("TTS refuses Kazakh/Cyrillic text (never read by a Turkish voice)", async () => {
  const r = await req(`/api/tts?t=${encodeURIComponent("Сәлем, қалайсың?")}`);
  assert.equal(r.status, 400);
});

await step("Page awareness + Kazakh explanation: «Осы тақырыпты түсінбедім» on page 35", async () => {
  const r = await chat(35, "Осы тақырыпты түсінбедім.", "free");
  assert.equal(r.status, 200);
  assert.ok(hasKazakh(r.text), "answer must be in Kazakh");
  assert.match(r.text, /35/, "should cite page 35");
  assert.match(r.text, /(ilik|ілік|tamlama|-\(?n\)?[iıuü]n|babası|Filiz)/i, "should explain the page's genitive/possessive topic");
  console.log(`      ${r.text.replace(/\s+/g, " ").slice(0, 260)}…`);
});

await step("Grammar correction of a wrong Turkish sentence", async () => {
  const r = await chat(58, "Bu cümle doğru mu: «Dün ben okula gidiyorum.»", "free");
  assert.equal(r.status, 200);
  assert.match(r.text, /gittim/, "should correct to past tense 'gittim'");
  assert.ok(hasKazakh(r.text));
  console.log(`      ${r.text.replace(/\s+/g, " ").slice(0, 220)}…`);
});

await step("Admits missing information instead of inventing textbook content", async () => {
  const r = await chat(8, "Осы беттегі диалогтағы Мехметтің телефон нөмірі қандай?", "free");
  assert.equal(r.status, 200);
  assert.match(r.text, /(жоқ|бос|табылмады|көрсетілмеген|айтылмаған)/i, `answer: ${r.text.slice(0, 200)}`);
});

await step("Writing evaluation returns structured A1 feedback", async () => {
  const r = await json("/api/ai/writing", { promptId: "u1w1", text: "Merhaba. Benim adım Aruzhan. Ben Kazakistan. Ben öğrenci. Ben Almatı'da oturuyorum. Ben Türkçe öğreniyorum." });
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d).slice(0, 300));
  assert.ok(d.feedback.corrected_text && Array.isArray(d.feedback.issues));
  assert.ok(d.feedback.issues.length >= 1, "should flag 'Ben Kazakistan' / missing -lI or -yim");
  assert.ok(hasKazakh(d.feedback.summary_kz));
  for (const k of ["task", "grammar", "vocabulary", "coherence"]) assert.ok(d.feedback.rubric[k] >= 0 && d.feedback.rubric[k] <= 4);
  console.log(`      corrected: ${d.feedback.corrected_text.slice(0, 160)}`);
});

const topic = { topic: "Tanışma", questions: ["Adınız ne?", "Nerelisiniz?", "Öğrenci misiniz?"] };
let teacherHistory = [];
await step("Speaking · ÖĞRETMEN: opens in Turkish with one question", async () => {
  const r = await json("/api/ai/speak", { ...topic, mode: "ogretmen", messages: [] });
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  assert.ok(d.reply && !hasCyrillic(d.speakText));
  assert.match(d.reply, /\?/);
  teacherHistory = [{ role: "assistant", content: d.reply }];
  console.log(`      AI: ${d.reply}`);
});

await step("Speaking · ÖĞRETMEN: corrects the mistake and explains in Kazakh", async () => {
  const msgs = [...teacherHistory, { role: "user", content: "Benim adım Aruzhan. Ben Kazakistan." }];
  const r = await json("/api/ai/speak", { ...topic, mode: "ogretmen", messages: msgs });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.match(d.reply, /Kazakistanlı/i, "should model 'Kazakistanlıyım'");
  assert.ok(hasKazakh(d.explanation || d.reply), "should include a Kazakh explanation");
  assert.ok(!hasCyrillic(d.speakText), "only the Turkish part is spoken");
  console.log(`      AI: ${d.reply}`);
});

await step("Speaking · SOHBET: natural reply, no mid-conversation correction, no Kazakh", async () => {
  const r1 = await json("/api/ai/speak", { ...topic, mode: "sohbet", messages: [] });
  const d1 = await r1.json();
  const msgs = [{ role: "assistant", content: d1.reply }, { role: "user", content: "Ben Kazakistan. Ben öğrenci, üniversite okuyorum." }];
  const r = await json("/api/ai/speak", { ...topic, mode: "sohbet", messages: msgs });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.ok(!hasCyrillic(d.reply), `no Kazakh in conversation mode: ${d.reply}`);
  assert.doesNotMatch(d.reply, /Doğrusu|Түсіндірме/);
  console.log(`      AI: ${d1.reply}\n      AI: ${d.reply}`);
  const fb = await json("/api/ai/speak", { ...topic, mode: "sohbet", messages: [...msgs, { role: "assistant", content: d.reply }], finish: true });
  const f = await fb.json();
  assert.equal(fb.status, 200, JSON.stringify(f).slice(0, 200));
  assert.ok(f.feedback.corrections.length >= 1, "feedback after the conversation should list corrections");
  assert.ok(hasKazakh(f.feedback.summary_kz));
  console.log(`      feedback: ${f.feedback.corrections.map((c) => `${c.said} → ${c.better}`).join("; ")}`);
});

await step("Voice turn: recorded Turkish audio → transcript → spoken Turkish reply (cached)", async () => {
  // a real audio "student answer", produced by TTS, sent exactly like a microphone recording
  const student = await tts("Ben Almatılıyım. Ben öğrenciyim.", "m");
  const fd = new FormData();
  fd.append("audio", new Blob([student.buf], { type: "audio/wav" }), "speech.wav");
  fd.append("meta", JSON.stringify({ ...topic, mode: "ogretmen", messages: teacherHistory }));
  const t = Date.now();
  const r = await req("/api/ai/speak", { method: "POST", body: fd });
  const d = await r.json();
  const turnMs = Date.now() - t;
  assert.equal(r.status, 200, JSON.stringify(d).slice(0, 300));
  assert.equal(norm(d.transcript), norm("Ben Almatılıyım. Ben öğrenciyim."), `transcript "${d.transcript}"`);
  assert.ok(d.reply && d.speakText);
  const voice = await tts(d.speakText);
  assert.equal(voice.status, 200);
  assert.equal(voice.cache, "hit", "reply audio is pre-synthesized during the turn");
  console.log(`      heard "${d.transcript}" · AI: ${d.reply} · turn ${turnMs} ms`);
});

await step("Chat microphone transcription in Kazakh", async () => {
  // Gemini TTS is Turkish-only here; use a Turkish clip but request kk-KZ mode to verify the route accepts it
  const a = await tts("Merhaba, nasılsınız?");
  const r = await transcribe(a.buf, "kk-KZ");
  assert.equal(r.status, 200);
  assert.ok(r.text.length > 3);
});

await step("Input validation and size limits", async () => {
  assert.equal((await req(`/api/tts?t=${"a".repeat(600)}`)).status, 400);
  const fd = new FormData();
  fd.append("audio", new Blob([Buffer.alloc(10)]), "x");
  assert.equal((await req("/api/ai/transcribe", { method: "POST", body: fd })).status, 400);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
