-- PROCHÉLIA V14.5.7 — security / identity schema
CREATE TABLE IF NOT EXISTS identity_verifications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', level TEXT NOT NULL DEFAULT 'standard',
 provider TEXT, provider_reference TEXT, verified_at TEXT, expires_at TEXT, rejection_reason TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_user ON identity_verifications(user_id,status,updated_at);
CREATE TABLE IF NOT EXISTS trusted_devices (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
 first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TEXT NOT NULL, revoked_at TEXT, UNIQUE(user_id,device_hash)
);
CREATE TABLE IF NOT EXISTS mission_security (
 id TEXT PRIMARY KEY, mission_id TEXT NOT NULL UNIQUE, client_id TEXT NOT NULL, intervenant_id TEXT NOT NULL,
 risk_level TEXT NOT NULL DEFAULT 'standard', arrival_code_hash TEXT, arrival_expires_at TEXT, arrival_used_at TEXT,
 end_code_hash TEXT, end_expires_at TEXT, end_used_at TEXT, status TEXT NOT NULL DEFAULT 'prepared', locked_until TEXT,
 arrival_started_at TEXT, ended_at TEXT, last_presence_at TEXT, last_device_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mission_security_intervenant ON mission_security(intervenant_id,status);
CREATE TABLE IF NOT EXISTS mission_security_attempts (
 id TEXT PRIMARY KEY, security_id TEXT NOT NULL, purpose TEXT NOT NULL, actor_user_id TEXT, device_id TEXT,
 result TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_security_attempts_security ON mission_security_attempts(security_id,created_at);
CREATE TABLE IF NOT EXISTS security_audit (
 id TEXT PRIMARY KEY, event_type TEXT NOT NULL, mission_id TEXT, user_id TEXT, actor_role TEXT,
 result TEXT NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_security_audit_mission ON security_audit(mission_id,created_at);
