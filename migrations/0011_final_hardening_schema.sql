-- PROCHÉLIA V14.5.7-EXPERT-PREPRODUCTION — final hardening schema
-- DDL moved out of Worker runtime into versioned migration.
CREATE TABLE IF NOT EXISTS system_config_checks (
 id TEXT PRIMARY KEY, check_code TEXT NOT NULL, status TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}', checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_config_checks_code ON system_config_checks(check_code,checked_at);
CREATE TABLE IF NOT EXISTS idempotency_records (
 id TEXT PRIMARY KEY, scope TEXT NOT NULL, idem_key TEXT NOT NULL, request_hash TEXT, response_json TEXT, status_code INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(scope,idem_key)
);
CREATE TABLE IF NOT EXISTS background_jobs (
 id TEXT PRIMARY KEY, job_type TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'PENDING',
 attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 5, run_after TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 locked_at TEXT, last_error TEXT, result_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_background_jobs_ready ON background_jobs(status,run_after,created_at);
CREATE TABLE IF NOT EXISTS security_rate_limits (
 id TEXT PRIMARY KEY, bucket TEXT NOT NULL, subject_hash TEXT NOT NULL, window_start TEXT NOT NULL,
 request_count INTEGER NOT NULL DEFAULT 0, UNIQUE(bucket,subject_hash,window_start)
);
CREATE TABLE IF NOT EXISTS integration_registry (
 id TEXT PRIMARY KEY, integration_code TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED', required_secrets_json TEXT NOT NULL DEFAULT '[]',
 capabilities_json TEXT NOT NULL DEFAULT '[]', last_checked_at TEXT, details_json TEXT NOT NULL DEFAULT '{}'
);
