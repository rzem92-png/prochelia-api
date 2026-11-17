-- PROCHÉLIA — national scale and continuity schema v1
-- Additive/idempotent. Includes exact NATIONAL_SCALE_DEFAULTS seeds formerly inserted at runtime.
-- Preview and Production were checked for these objects on 2026-11-15; none existed.
-- Reconcile each environment before applying; never run from a request handler.

CREATE TABLE IF NOT EXISTS platform_scale_config (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value_json TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS backup_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  storage_provider TEXT,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  object_count INTEGER DEFAULT 0,
  row_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata_json TEXT
);
CREATE TABLE IF NOT EXISTS backup_objects (
  id TEXT PRIMARY KEY,
  backup_run_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  table_name TEXT,
  row_count INTEGER DEFAULT 0,
  byte_size INTEGER DEFAULT 0,
  checksum TEXT,
  encrypted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_backup_runs_date ON backup_runs(status,started_at);
CREATE INDEX IF NOT EXISTS idx_backup_objects_run ON backup_objects(backup_run_id);
CREATE INDEX IF NOT EXISTS idx_scale_key ON platform_scale_config(key);

-- Preserve any existing operator-configured values.
INSERT OR IGNORE INTO platform_scale_config(id,key,value_json) VALUES
('scale-maxPageSize','maxPageSize','100'),
('scale-defaultPageSize','defaultPageSize','50'),
('scale-importBatchSize','importBatchSize','500'),
('scale-noArtificialUserCap','noArtificialUserCap','true'),
('scale-cursorPaginationRecommended','cursorPaginationRecommended','true'),
('scale-documentsStorage','documentsStorage','"R2"'),
('scale-backupFrequency','backupFrequency','"DAILY"'),
('scale-backupRetentionDays','backupRetentionDays','90');
