-- Additive login brute-force protection.
-- Raw IP addresses and email addresses are never stored in this table.
CREATE TABLE IF NOT EXISTS auth_login_rate_limits (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bucket, subject_hash, window_start)
);

CREATE INDEX IF NOT EXISTS idx_auth_login_rate_limits_window
  ON auth_login_rate_limits(window_start);
