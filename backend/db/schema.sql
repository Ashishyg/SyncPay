CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  phone       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  pub_key     TEXT NOT NULL,
  enc_key_bkp TEXT,
  kyc_status  TEXT DEFAULT 'pending',
  created_at  INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS wallets (
  id              TEXT PRIMARY KEY,
  user_id         TEXT UNIQUE NOT NULL REFERENCES users(id),
  confirmed_bal   INTEGER DEFAULT 0,
  locked_bal      INTEGER DEFAULT 0,
  nonce_counter   INTEGER DEFAULT 0,
  daily_spent     INTEGER DEFAULT 0,
  daily_date      TEXT DEFAULT '',
  updated_at      INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY,
  from_user_id  TEXT REFERENCES users(id),
  to_user_id    TEXT REFERENCES users(id),
  amount        INTEGER NOT NULL,
  nonce         INTEGER NOT NULL,
  signature     TEXT NOT NULL,
  mode          TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',
  fail_reason   TEXT,
  created_at    INTEGER NOT NULL,
  synced_at     INTEGER,
  expires_at    INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_nonce ON transactions(from_user_id, nonce);

CREATE TABLE IF NOT EXISTS withdrawals (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  amount        INTEGER NOT NULL,
  bank_name     TEXT NOT NULL,
  account_no    TEXT NOT NULL,
  ifsc          TEXT NOT NULL,
  status        TEXT DEFAULT 'initiated',
  utr_number    TEXT,
  initiated_at  INTEGER DEFAULT (unixepoch()),
  completed_at  INTEGER
);

CREATE TABLE IF NOT EXISTS otp_sessions (
  phone       TEXT PRIMARY KEY,
  otp_hash    TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS devices (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id),
  device_name TEXT,
  last_seen   INTEGER,
  is_active   INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id),
  type        TEXT,
  title       TEXT,
  body        TEXT,
  is_read     INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT (unixepoch())
);
