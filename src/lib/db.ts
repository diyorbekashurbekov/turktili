import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
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

const g = globalThis as unknown as { __yiDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__yiDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const d = new DatabaseSync(path.join(DATA_DIR, "app.db"));
    d.exec(SCHEMA);
    g.__yiDb = d;
  }
  return g.__yiDb;
}

export function dataDir() {
  return DATA_DIR;
}

type Row = Record<string, unknown>;
// node:sqlite returns null-prototype objects; React cannot pass those to client components.
const plain = <T,>(r: unknown) => (r ? ({ ...(r as object) } as T) : undefined);
export const q = {
  get<T = Row>(sql: string, ...params: (string | number | null)[]): T | undefined {
    return plain<T>(db().prepare(sql).get(...params));
  },
  all<T = Row>(sql: string, ...params: (string | number | null)[]): T[] {
    return db().prepare(sql).all(...params).map((r) => ({ ...(r as object) }) as T);
  },
  run(sql: string, ...params: (string | number | null)[]) {
    return db().prepare(sql).run(...params);
  },
};

export function logError(route: string, err: unknown) {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  try {
    q.run("INSERT INTO error_log (route, message) VALUES (?, ?)", route, message.slice(0, 2000));
  } catch {
    // the error log must never throw
  }
}
