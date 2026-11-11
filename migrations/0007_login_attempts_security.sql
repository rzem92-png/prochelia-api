-- PROCHÉLIA — login throttling evidence schema
-- Additive migration. Login handlers must never create or alter schema at request time.
CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_key_created
  ON login_attempts(key_hash,created_at);
