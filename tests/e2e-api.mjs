// End-to-end journey tests against a running server: `npm run dev` then `npm run e2e`.
// Exercises real HTTP routes, cookies, database writes and server-side grading.
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3100";
const ADMIN = process.env.E2E_ADMIN_EMAIL || "admin@yedi.test";
let passed = 0;
const failures = [];

class Client {
  cookie = "";
  async req(path, opts = {}) {
    const res = await fetch(BASE + path, { ...opts, redirect: "manual", headers: { ...(opts.headers || {}), cookie: this.cookie } });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [kv] = c.split(";");
      if (kv.startsWith("yi_sid=")) this.cookie = kv;
    }
    return res;
  }
  async json(path, body) {
    const res = await this.req(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  async html(path) {
    const res = await this.req(path);
    return { status: res.status, text: await res.text(), location: res.headers.get("location") };
  }
}

async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n    ${e.message}`);
  }
}

const s = new Client();
const stamp = Date.now();
console.log(`E2E against ${BASE}`);

await step("home renders with the book as hero and sets a guest session", async () => {
  const r = await s.html("/");
  assert.equal(r.status, 200);
  assert.match(r.text, /Кітапты ашу/);
  assert.ok(s.cookie.startsWith("yi_sid="), "session cookie");
});

await step("all 192 book pages render", async () => {
  const bad = [];
  for (let n = 1; n <= 192; n += 1) {
    const r = await s.req(`/kitap/${n}`);
    if (r.status !== 200) bad.push(`${n}:${r.status}`);
    await r.arrayBuffer();
  }
  assert.deepEqual(bad, []);
  assert.equal((await s.req("/kitap/193")).status, 404);
});

await step("table of contents and textbook-centered navigation", async () => {
  const r = await s.html("/kitap");
  assert.equal(r.status, 200);
  for (const t of ["Tanışma", "Ailemiz", "Tatil", "İçindekiler"]) assert.match(r.text, new RegExp(t));
});

await step("page progress, bookmark and note persist", async () => {
  assert.equal((await s.json("/api/progress", { type: "page", page: 35, status: "completed" })).status, 200);
  assert.equal((await s.json("/api/progress", { type: "bookmark", page: 35, on: true })).status, 200);
  assert.equal((await s.json("/api/progress", { type: "note", page: 35, text: "ilik: annemin adı" })).status, 200);
  const r = await s.html("/kitap/35");
  assert.match(r.text, /Аяқталды/);
  assert.match(r.text, /ilik: annemin adı/);
  const toc = await s.html("/kitap");
  assert.match(toc.text, /35-бет/);
});

await step("instant word explanation resolves inflected forms", async () => {
  const r = await (await s.req("/api/words?q=" + encodeURIComponent("kitabı"))).json();
  assert.ok(r.matches.some((m) => m.tr.startsWith("kitap")), JSON.stringify(r));
  const r2 = await (await s.req("/api/words?q=merhaba")).json();
  assert.equal(r2.matches[0].kz.includes("сәлем"), true);
});

await step("vocabulary: session, spaced repetition review and saving", async () => {
  const page = await s.html("/kelime/calis?set=unit:2&mode=tr-kz");
  assert.equal(page.status, 200);
  const r = await s.json("/api/progress", { type: "vocab-review", wordId: "w1", grade: 2 });
  assert.equal(r.status, 200);
  assert.equal(r.data.state.interval_days, 1);
  assert.equal((await s.json("/api/progress", { type: "vocab-save", wordId: "w1", saved: true })).status, 200);
  const hub = await s.html("/kelime");
  assert.match(hub.text.replace(/<!-- -->/g, ""), /Қиын сөздерім · 1/);
});

await step("practice pages for all 8 units × 5 skills render", async () => {
  const bad = [];
  for (let u = 1; u <= 8; u++)
    for (const sk of ["okuma", "dinleme", "gramer", "yazma", "konusma"]) {
      const r = await s.req(`/pratik/${u}/${sk}`);
      if (r.status !== 200) bad.push(`${u}/${sk}`);
      await r.arrayBuffer();
    }
  assert.deepEqual(bad, []);
});

await step("mistakes are recorded and listed, then resolved by a correct answer", async () => {
  await s.json("/api/progress", { type: "attempts", skill: "gramer", unit: 1, items: [{ itemId: "u1g1", correct: false, given: "mı" }] });
  let r = await s.html("/hatalar");
  assert.match(r.text, /Bu kalem ___\?/);
  await s.json("/api/progress", { type: "attempts", skill: "gramer", unit: 1, items: [{ itemId: "u1g1", correct: true, given: "mi" }] });
  r = await s.html("/hatalar");
  assert.doesNotMatch(r.text, /Bu kalem ___\?/);
});

let examId;
await step("exam: start, answer key stays on server, submit, graded report", async () => {
  const start = await s.json("/api/exams", { action: "start", type: "okuma" });
  assert.equal(start.status, 200);
  examId = start.data.id;
  const run = await s.html(`/sinav/${examId}`);
  assert.equal(run.status, 200);
  assert.doesNotMatch(run.text, /\\"answer\\"|"answer":/, "answer key must not be sent to the browser");
  assert.doesNotMatch(run.text, /\\"explain\\"/);
  const sub = await s.json("/api/exams", { action: "submit", id: examId, answers: { u1r1: 1, u1r2: true } });
  assert.equal(sub.status, 200);
  const res = await s.html(`/sinav/${examId}/sonuc`);
  assert.equal(res.status, 200);
  assert.match(res.text, /%/);
  const again = await s.html(`/sinav/${examId}`);
  assert.equal(again.status, 307, "finished exam redirects to result");
});

await step("full mock exam composes all four skills", async () => {
  const start = await s.json("/api/exams", { action: "start", type: "full" });
  const run = await s.html(`/sinav/${start.data.id}`);
  for (const k of ["reading", "listening", "writing", "speaking"]) assert.match(run.text, new RegExp(k));
});

await step("focus mode: create plan, recalculate, render today", async () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal((await s.json("/api/focus", { action: "create", today, mode: "14" })).status, 200);
  const r = await s.html("/odak");
  assert.equal(r.status, 200);
  assert.match(r.text, /Сөздерді қайталау/, "plan tasks are delivered to the focus view");
  assert.equal((await s.json("/api/focus", { action: "recalc", today })).status, 200);
  const bad = await s.json("/api/focus", { action: "create", today, mode: "custom", examDate: "2000-01-01" });
  assert.equal(bad.status, 400);
});

await step("AI routes are guarded (real integration boundary, no fake answers)", async () => {
  const chat = await s.req("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: 35, messages: [{ role: "user", content: "Осы тақырыпты түсінбедім." }] }) });
  if (chat.status === 503) {
    // no GEMINI_API_KEY on the server
    const d = await chat.json();
    assert.equal(d.code, "not_configured");
    const w = await s.json("/api/ai/writing", { promptId: "u1w1", text: "Merhaba. Benim adım Aruzhan. Ben Kazakistanlıyım." });
    assert.equal(w.status, 503);
    assert.equal(w.data.saved, true, "student text is kept even without AI");
  } else if (chat.status === 200) {
    assert.ok((await chat.text()).length > 20);
  } else {
    // configured but limited (quota / rate limit): must be an honest error, never a fake answer
    assert.ok([429, 502].includes(chat.status), `unexpected status ${chat.status}`);
    assert.ok((await chat.json()).error);
  }
});

await step("input validation rejects malformed requests", async () => {
  assert.equal((await s.json("/api/progress", { type: "page", page: 999, status: "completed" })).status, 400);
  assert.equal((await s.json("/api/ai/chat", { messages: [] })).status, 400);
});

const email = `student${stamp}@yedi.test`;
await step("accounts: guest upgrade keeps progress, login/logout, wrong password", async () => {
  const reg = await s.json("/api/auth", { action: "register", email, password: "secret-pass-1", name: "Aruzhan" });
  assert.equal(reg.status, 200, JSON.stringify(reg.data));
  const acc = await s.html("/hesap");
  assert.match(acc.text, /Aruzhan/);
  assert.match(acc.text, /Аяқталған бет/);
  await s.json("/api/auth", { action: "logout" });
  const fresh = new Client();
  await fresh.html("/");
  assert.equal((await fresh.json("/api/auth", { action: "login", email, password: "nope" })).status, 400);
  assert.equal((await fresh.json("/api/auth", { action: "login", email, password: "secret-pass-1" })).status, 200);
  const page = await fresh.html("/kitap/35");
  assert.match(page.text, /ilik: annemin adı/, "progress follows the account to a new device");
  assert.equal((await fresh.json("/api/auth", { action: "register", email, password: "another-pass", name: "X" })).status, 400);
});

await step("admin area is protected and works for admins", async () => {
  const student = new Client();
  await student.html("/");
  assert.equal((await student.json("/api/admin", { action: "errors-clear" })).status, 403);
  const page = await student.html("/admin");
  assert.match(page.text, /Рұқсат жоқ/);
  const admin = new Client();
  await admin.html("/");
  const adminEmail = ADMIN.replace("@", `+${stamp}@`);
  void adminEmail;
  let r = await admin.json("/api/auth", { action: "register", email: ADMIN, password: "admin-pass-123", name: "Admin" });
  if (r.status !== 200) r = await admin.json("/api/auth", { action: "login", email: ADMIN, password: "admin-pass-123" });
  assert.equal(r.status, 200, "admin login");
  const panel = await admin.html("/admin");
  assert.match(panel.text, /Page coverage/);
  assert.match(panel.text, /192/);
  const set = await admin.json("/api/admin", { action: "settings", aiEnabled: true, textModel: "gemini-2.5-flash", ttsModel: "gemini-3.8-flash-tts", dailyBudgetUsd: 5, guestDailyRequests: 15, memberDailyRequests: 60, ttsDailyPerUser: 400, pageImagesAuthorized: false });
  assert.equal(set.status, 200);
  const ov = await admin.json("/api/admin", { action: "page-override", page: 12, field: "title", value: "Tanıştırma (edited)" });
  assert.equal(ov.status, 200);
  assert.match((await s.html("/kitap/12")).text, /Tanıştırma \(edited\)/);
  await admin.json("/api/admin", { action: "page-override-clear", page: 12, field: "title" });
  assert.doesNotMatch((await s.html("/kitap/12")).text, /\(edited\)/);

  // authorised audio: upload → listed on the page → played back byte-for-byte → deleted
  const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(2000, 7)]);
  const fd = new FormData();
  fd.append("page", "12");
  fd.append("title", `e2e audio ${stamp}`);
  fd.append("file", new Blob([wav], { type: "audio/wav" }), "clip.wav");
  assert.equal((await admin.req("/api/admin", { method: "POST", body: fd })).status, 200);
  const audioPage = (await admin.html("/admin?tab=ses")).text;
  const audioId = Number(new RegExp(`/api/audio/(\\d+)[^]*?e2e audio ${stamp}|e2e audio ${stamp}[^]*?/api/audio/(\\d+)`).exec(audioPage)?.slice(1).find(Boolean));
  assert.ok(audioId, "uploaded audio is listed");
  const played = await s.req(`/api/audio/${audioId}`);
  assert.equal(played.status, 200);
  assert.ok(Buffer.from(await played.arrayBuffer()).equals(wav), "audio bytes round-trip through storage");
  assert.equal((await admin.json("/api/admin", { action: "audio-delete", id: audioId })).status, 200);
  assert.equal((await s.req(`/api/audio/${audioId}`)).status, 404);
});

await step("original page images are withheld unless rights are confirmed", async () => {
  assert.equal((await s.req("/api/page-image/10")).status, 403);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
