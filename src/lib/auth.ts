import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { q } from "./db";

export const SESSION_COOKIE = "yi_sid";
const SESSION_DAYS = 180;

export type User = {
  id: string;
  email: string | null;
  name: string | null;
  role: "student" | "admin";
  exam_date: string | null;
  prefs: string;
  last_page: number | null;
  disabled: number;
};

const adminEmails = () =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function isGuest(u: User) {
  return !u.email;
}

export function isAdmin(u: User | null) {
  if (!u || !u.email) return false;
  return u.role === "admin" || adminEmails().includes(u.email.toLowerCase());
}

function newId() {
  return crypto.randomBytes(16).toString("hex");
}

async function createGuest(): Promise<User> {
  const id = newId();
  await q.run("INSERT INTO users (id) VALUES (?)", id);
  return (await q.get<User>("SELECT * FROM users WHERE id = ?", id))!;
}

async function bindSession(sid: string, userId: string) {
  await q.run(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', ?)) ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, expires_at = excluded.expires_at",
    sid,
    userId,
    `+${SESSION_DAYS} days`,
  );
}

/**
 * Returns the current user. The middleware guarantees a session id cookie;
 * the first request on a new session creates a guest user so that progress
 * is saved immediately without forcing registration.
 */
export async function currentUser(): Promise<User> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid || sid.length < 32) {
    // No cookie (e.g. API call without middleware) — ephemeral guest.
    return await createGuest();
  }
  const row = await q.get<User>(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > datetime('now')",
    sid,
  );
  if (row && !row.disabled) return row;
  const guest = await createGuest();
  await bindSession(sid, guest.id);
  return guest;
}

export async function currentSessionId() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

// ---------- passwords ----------
export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string | null) {
  if (!stored) return false;
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const got = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, got);
}

export async function register(email: string, password: string, name: string) {
  const user = await currentUser();
  const sid = await currentSessionId();
  const exists = await q.get("SELECT id FROM users WHERE lower(email) = lower(?)", email);
  if (exists) return { ok: false as const, error: "Бұл email тіркелген." };
  if (isGuest(user)) {
    // Upgrade the guest in place so existing progress is kept.
    await q.run("UPDATE users SET email = ?, name = ?, password_hash = ? WHERE id = ?", email, name, hashPassword(password), user.id);
    return { ok: true as const };
  }
  const id = newId();
  await q.run("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)", id, email, name, hashPassword(password));
  if (sid) await bindSession(sid, id);
  return { ok: true as const };
}

export async function login(email: string, password: string) {
  const row = await q.get<User & { password_hash: string }>("SELECT * FROM users WHERE lower(email) = lower(?)", email);
  if (!row || row.disabled || !verifyPassword(password, row.password_hash)) {
    return { ok: false as const, error: "Email немесе құпиясөз қате." };
  }
  const sid = await currentSessionId();
  if (!sid) return { ok: false as const, error: "Сессия табылмады. Бетті жаңартыңыз." };
  await bindSession(sid, row.id);
  return { ok: true as const };
}

export async function logout() {
  const sid = await currentSessionId();
  if (sid) await q.run("DELETE FROM sessions WHERE id = ?", sid);
}

// ---------- tiny in-memory rate limiter (per process) ----------
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}
