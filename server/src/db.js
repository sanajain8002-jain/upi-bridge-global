import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SAMPLE_RATES, DEFAULT_FEE_MODEL } from './config.js';

// Local prototype database (SQLite via Node's built-in node:sqlite - zero install).
// db/schema.sql contains the equivalent PostgreSQL / Supabase schema for deployment.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'IN',
  preferred_currency TEXT NOT NULL DEFAULT 'INR',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  is_demo INTEGER NOT NULL DEFAULT 0,
  kyc_stage TEXT NOT NULL DEFAULT 'not_started' CHECK (kyc_stage IN ('not_started','submitted','under_review','verified')),
  kyc_demo_name TEXT,
  kyc_demo_doc TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_id TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  country TEXT NOT NULL,
  receive_currency TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_identifier TEXT NOT NULL,
  amount_inr REAL NOT NULL,
  mid_rate REAL NOT NULL,
  effective_rate REAL NOT NULL,
  markup_percent REAL NOT NULL,
  markup_cost_inr REAL NOT NULL,
  fee_inr REAL NOT NULL,
  total_payable_inr REAL NOT NULL,
  recipient_amount REAL NOT NULL,
  rate_source TEXT NOT NULL,
  rate_updated_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','successful','failed')),
  failure_reason TEXT,
  risk_level TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  simulated INTEGER NOT NULL DEFAULT 1 CHECK (simulated = 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_txn_user_created ON transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_txn_country ON transactions(country);
CREATE INDEX IF NOT EXISTS idx_txn_status ON transactions(status);
CREATE TABLE IF NOT EXISTS rates (
  currency TEXT PRIMARY KEY,
  per_inr REAL NOT NULL CHECK (per_inr > 0),
  source TEXT NOT NULL DEFAULT 'sample',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency TEXT NOT NULL,
  per_inr REAL NOT NULL,
  source TEXT NOT NULL,
  changed_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS risk_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_id TEXT NOT NULL REFERENCES transactions(txn_id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  level TEXT NOT NULL CHECK (level IN ('low','medium','high')),
  score INTEGER NOT NULL,
  reasons TEXT NOT NULL,
  suggested_step TEXT NOT NULL,
  engine TEXT NOT NULL DEFAULT 'rule-based',
  review_status TEXT NOT NULL DEFAULT 'open' CHECK (review_status IN ('open','cleared','escalated')),
  reviewed_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function openDb(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  ensureDefaults(db);
  return db;
}

/** Seed config tables (rates + fee model) if empty. Idempotent. */
export function ensureDefaults(db) {
  const now = new Date().toISOString();
  // INSERT OR IGNORE: adds newly supported currencies to an existing database without overwriting admin edits.
  const ins = db.prepare('INSERT OR IGNORE INTO rates (currency, per_inr, source, updated_at) VALUES (?,?,?,?)');
  for (const [cur, rate] of Object.entries(SAMPLE_RATES)) ins.run(cur, rate, 'sample', now);
  const hasFee = db.prepare("SELECT 1 FROM settings WHERE key='fee_model'").get();
  if (!hasFee) db.prepare("INSERT INTO settings (key,value) VALUES ('fee_model', ?)").run(JSON.stringify(DEFAULT_FEE_MODEL));
}

export function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row ? JSON.parse(row.value) : null;
}

export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));
}
