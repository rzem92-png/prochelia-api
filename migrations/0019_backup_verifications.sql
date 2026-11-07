-- PROCHÉLIA V14.5.7 — backup verification history
CREATE TABLE IF NOT EXISTS backup_verifications (
 id TEXT PRIMARY KEY, backup_run_id TEXT NOT NULL, status TEXT NOT NULL, verified_objects INTEGER NOT NULL,
 failed_objects INTEGER NOT NULL, report_json TEXT NOT NULL, checked_at TEXT DEFAULT CURRENT_TIMESTAMP
);
