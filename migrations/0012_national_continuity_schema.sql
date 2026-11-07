-- PROCHÉLIA V14.5.7-EXPERT-PREPRODUCTION — national continuity schema and initial defaults
CREATE TABLE IF NOT EXISTS platform_scale_config (
 id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, value_json TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS backup_runs (
 id TEXT PRIMARY KEY, status TEXT NOT NULL, trigger_type TEXT NOT NULL, storage_provider TEXT,
 started_at TEXT DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, object_count INTEGER DEFAULT 0, row_count INTEGER DEFAULT 0,
 error_message TEXT, metadata_json TEXT
);
CREATE TABLE IF NOT EXISTS backup_objects (
 id TEXT PRIMARY KEY, backup_run_id TEXT NOT NULL, object_key TEXT NOT NULL, table_name TEXT, row_count INTEGER DEFAULT 0,
 byte_size INTEGER DEFAULT 0, checksum TEXT, encrypted INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_backup_runs_date ON backup_runs(status,started_at);
CREATE INDEX IF NOT EXISTS idx_backup_objects_run ON backup_objects(backup_run_id);
CREATE INDEX IF NOT EXISTS idx_scale_key ON platform_scale_config(key);
INSERT OR IGNORE INTO platform_scale_config(id,key,value_json) VALUES
 ('scale-default-maxPageSize','maxPageSize','100'),
 ('scale-default-defaultPageSize','defaultPageSize','50'),
 ('scale-default-importBatchSize','importBatchSize','500'),
 ('scale-default-noArtificialUserCap','noArtificialUserCap','true'),
 ('scale-default-cursorPaginationRecommended','cursorPaginationRecommended','true'),
 ('scale-default-documentsStorage','documentsStorage','"R2"'),
 ('scale-default-backupFrequency','backupFrequency','"DAILY"'),
 ('scale-default-backupRetentionDays','backupRetentionDays','90');
