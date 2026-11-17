-- PROCHÉLIA V14.5.7-EXPERT-PREPRODUCTION — production security event schema
CREATE TABLE IF NOT EXISTS production_security_events (
 id TEXT PRIMARY KEY, event_type TEXT NOT NULL, route TEXT, subject_hash TEXT,
 decision TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prod_sec_events_date ON production_security_events(event_type,created_at);
