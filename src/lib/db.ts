import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Client } from "@libsql/client";

// Database backend:
//  - TURSO_DATABASE_URL set → libSQL (Turso). Required on Vercel: each route runs as a separate
//    serverless function with its own temporary disk, so a local file would not be shared.
//    A "file:" URL uses a local libSQL file (for testing this code path without an account).
//  - otherwise → a local SQLite file via the built-in node:sqlite (development, tests, Railway volume).
// Both are SQLite, so every query is shared.
// Railway: a volume exposes RAILWAY_VOLUME_MOUNT_PATH; DATA_DIR wins if set explicitly
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), "data");
const TURSO_URL = process.env.TURSO_DATABASE_URL;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  exam_date TEXT,
  prefs TEXT NOT NULL DEFAULT '{}',
  last_page INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  disabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS page_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, page)
);
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, page)
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  text TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS vocab_state (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id TEXT NOT NULL,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0,
  due_at TEXT,
  saved INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT,
  PRIMARY KEY (user_id, word_id)
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  unit INTEGER,
  item_id TEXT NOT NULL,
  correct INTEGER NOT NULL,
  given TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS attempts_user ON attempts(user_id, skill);
CREATE TABLE IF NOT EXISTS writings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL,
  text TEXT NOT NULL,
  feedback TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS speaking_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  transcript TEXT NOT NULL DEFAULT '[]',
  feedback TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  config TEXT NOT NULL,
  answers TEXT,
  result TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS focus_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_date TEXT NOT NULL,
  start_date TEXT NOT NULL,
  mode TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS focus_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES focus_plans(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  title TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  done_at TEXT
);
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  route TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ai_usage_day ON ai_usage(created_at);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS content_overrides (
  page INTEGER NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (page, field)
);
CREATE TABLE IF NOT EXISTS vocab_overrides (
  word_id TEXT PRIMARY KEY,
  tr TEXT NOT NULL,
  kz TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audio_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page INTEGER NOT NULL,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

type Param = string | number | null;
type Row = Record<string, unknown>;
type RunResult = { changes: number; lastInsertRowid: number };
type Backend = {
  all(sql: string, params: Param[]): Promise<Row[]>;
  run(sql: string, params: Param[]): Promise<RunResult>;
};

function localBackend(): Backend {
  // required lazily so a Turso deployment never opens node:sqlite
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync: Sqlite } = require("node:sqlite") as { DatabaseSync: typeof DatabaseSync };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const d = new Sqlite(path.join(DATA_DIR, "app.db"));
  d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;" + SCHEMA);
  return {
    // node:sqlite returns null-prototype objects; React cannot pass those to client components.
    async all(sql, params) {
      return d.prepare(sql).all(...params).map((r) => ({ ...(r as object) }) as Row);
    },
    async run(sql, params) {
      const r = d.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
    },
  };
}

async function tursoBackend(url: string): Promise<Backend> {
  // the web client is pure fetch (no native module) — what Vercel runs; file: URLs need the Node client
  const { createClient } = url.startsWith("file:") ? await import("@libsql/client") : await import("@libsql/client/web");
  const c: Client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await c.executeMultiple(SCHEMA);
  const plain = (v: unknown) => (typeof v === "bigint" ? Number(v) : v);
  return {
    async all(sql, params) {
      const rs = await c.execute({ sql, args: params });
      return rs.rows.map((r) => Object.fromEntries(rs.columns.map((col, i) => [col, plain(r[i])])) as Row);
    },
    async run(sql, params) {
      const rs = await c.execute({ sql, args: params });
      return { changes: rs.rowsAffected, lastInsertRowid: Number(rs.lastInsertRowid ?? 0) };
    },
  };
}

const g = globalThis as unknown as { __yiDb?: Promise<Backend> };

function backend(): Promise<Backend> {
  if (!g.__yiDb) {
    g.__yiDb = (TURSO_URL ? tursoBackend(TURSO_URL) : Promise.resolve().then(localBackend)).catch((err) => {
      g.__yiDb = undefined; // retry on the next request instead of caching the failure
      throw err;
    });
  }
  return g.__yiDb;
}

/** Which backend this process uses — for the health check (never exposes the URL or token). */
export const dbKind = () => (TURSO_URL ? "turso" : "sqlite");

export function dataDir() {
  return DATA_DIR;
}

export const q = {
  async get<T = Row>(sql: string, ...params: Param[]): Promise<T | undefined> {
    return (await (await backend()).all(sql, params))[0] as T | undefined;
  },
  async all<T = Row>(sql: string, ...params: Param[]): Promise<T[]> {
    return (await (await backend()).all(sql, params)) as T[];
  },
  async run(sql: string, ...params: Param[]): Promise<RunResult> {
    return (await backend()).run(sql, params);
  },
};

export async function logError(route: string, err: unknown) {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  try {
    await q.run("INSERT INTO error_log (route, message) VALUES (?, ?)", route, message.slice(0, 2000));
  } catch {
    // the error log must never throw
  }
}
