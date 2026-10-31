-- PROCHÉLIA V14.5.8 — persistent rate-limit buckets
-- Additive and replay-safe. No user or financial rows are created or changed.
-- Required by the request middleware; requests now fail closed if this migration
-- has not been applied, rather than creating schema at runtime.

CREATE TABLE IF NOT EXISTS security_rate_limits (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  window_start TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  UNIQUE(bucket, subject_hash, window_start)
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_window
  ON security_rate_limits(bucket, window_start);
