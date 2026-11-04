-- TEST ONLY: reproduce the pre-existing auth schema required by migration 0001.
-- This file is applied only to Wrangler's ephemeral local D1 in CI.
CREATE TABLE users (
  id TEXT PRIMARY KEY, role TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, phone TEXT,
  password_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, user_id TEXT, token_hash TEXT, expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL,
  title TEXT NOT NULL, message TEXT NOT NULL, entity_type TEXT,
  entity_id TEXT, read_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
