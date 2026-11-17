-- PROCHÉLIA V14.5.7-EXPERT-PREPRODUCTION — Trust Passport persistence
-- Runtime schema creation is prohibited; apply through the migration pipeline only.
CREATE TABLE IF NOT EXISTS trust_service_catalog (
  service_code TEXT PRIMARY KEY,
  prestation_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  require_identity INTEGER NOT NULL DEFAULT 1,
  requirements_json TEXT NOT NULL DEFAULT '[]',
  allow_global_scope INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trust_verifications (
  id TEXT PRIMARY KEY,
  intervenant_id TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  service_code TEXT NOT NULL,
  valid_from TEXT,
  expires_at TEXT,
  requires_expiry INTEGER NOT NULL DEFAULT 0,
  proof_document_id TEXT NOT NULL,
  verified_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(intervenant_id,category,service_code,proof_document_id)
);

CREATE INDEX IF NOT EXISTS idx_trust_verifications_lookup
  ON trust_verifications(intervenant_id,service_code,category,status,expires_at);
