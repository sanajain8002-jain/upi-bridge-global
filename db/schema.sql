-- UPI Bridge Global - database schema (PostgreSQL / Supabase flavour).
-- The local prototype uses SQLite (server/src/db.js) with the same tables and columns.
-- All data is DEMO data. No real banking credentials, UPI PINs, OTPs or identity documents are stored.

CREATE TABLE users (
  id               BIGSERIAL PRIMARY KEY,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT,                        -- NULL for demo accounts
  name             TEXT NOT NULL,
  country          TEXT NOT NULL DEFAULT 'IN',
  preferred_currency TEXT NOT NULL DEFAULT 'INR',
  role             TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  is_demo          BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_stage        TEXT NOT NULL DEFAULT 'not_started'
                   CHECK (kyc_stage IN ('not_started','submitted','under_review','verified')),
  kyc_demo_name    TEXT,                        -- fictional demo identity only
  kyc_demo_doc     TEXT,                        -- placeholder document label only
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
  id                    BIGSERIAL PRIMARY KEY,
  txn_id                TEXT UNIQUE NOT NULL,   -- e.g. UBG-20261015-K7M2XQ4P
  user_id               BIGINT NOT NULL REFERENCES users(id),
  country               TEXT NOT NULL,
  receive_currency      TEXT NOT NULL,
  recipient_name        TEXT NOT NULL,
  recipient_identifier  TEXT NOT NULL,          -- simulated identifier
  amount_inr            NUMERIC(14,2) NOT NULL,
  mid_rate              NUMERIC(18,8) NOT NULL,
  effective_rate        NUMERIC(18,8) NOT NULL,
  markup_percent        NUMERIC(6,3) NOT NULL,
  markup_cost_inr       NUMERIC(14,2) NOT NULL,
  fee_inr               NUMERIC(14,2) NOT NULL,
  total_payable_inr     NUMERIC(14,2) NOT NULL,
  recipient_amount      NUMERIC(20,3) NOT NULL,
  rate_source           TEXT NOT NULL,          -- 'sample' | 'live'
  rate_updated_at       TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('pending','successful','failed')),
  failure_reason        TEXT,
  risk_level            TEXT NOT NULL,
  risk_score            INT NOT NULL,
  simulated             BOOLEAN NOT NULL DEFAULT TRUE CHECK (simulated),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX idx_txn_country ON transactions(country);
CREATE INDEX idx_txn_status ON transactions(status);

CREATE TABLE rates (
  currency    TEXT PRIMARY KEY,
  per_inr     NUMERIC(18,8) NOT NULL CHECK (per_inr > 0),
  source      TEXT NOT NULL DEFAULT 'sample',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rate_snapshots (
  id          BIGSERIAL PRIMARY KEY,
  currency    TEXT NOT NULL,
  per_inr     NUMERIC(18,8) NOT NULL,
  source      TEXT NOT NULL,
  changed_by  BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE risk_alerts (
  id          BIGSERIAL PRIMARY KEY,
  txn_id      TEXT NOT NULL REFERENCES transactions(txn_id),
  user_id     BIGINT NOT NULL REFERENCES users(id),
  level       TEXT NOT NULL CHECK (level IN ('low','medium','high')),
  score       INT NOT NULL,
  reasons     JSONB NOT NULL,
  suggested_step TEXT NOT NULL,
  engine      TEXT NOT NULL DEFAULT 'rule-based',
  review_status TEXT NOT NULL DEFAULT 'open' CHECK (review_status IN ('open','cleared','escalated')),
  reviewed_by BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- Supabase row-level security sketch (enable when using Supabase Auth):
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY own_txn ON transactions FOR SELECT USING (user_id = auth_user_id());
-- Admin access should go through the server with a service role, never from the browser.
