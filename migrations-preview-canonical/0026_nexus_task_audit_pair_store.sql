-- Nexus Supra durable task + audit pair store.
-- Preview/dev/test only. A caller must use D1.batch() so the guard and writes
-- share one atomic transaction. No executor or production route is enabled.

CREATE TABLE IF NOT EXISTS nexus_task_snapshots (
  task_id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT,
  scope_key TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('preview','development','test')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  state TEXT NOT NULL CHECK (state IN ('RECEIVED','PLANNED','AUTHORIZED','QUEUED','RUNNING','VERIFYING','RETRY_WAIT','COMPLETED','FAILED','ESCALATED','CANCELLED')),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (scope_key = COALESCE(tenant_id, '__GLOBAL__'))
);

CREATE TABLE IF NOT EXISTS nexus_task_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  tenant_id TEXT,
  scope_key TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('preview','development','test')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  event_json TEXT NOT NULL CHECK (json_valid(event_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, revision),
  CHECK (scope_key = COALESCE(tenant_id, '__GLOBAL__')),
  FOREIGN KEY (task_id) REFERENCES nexus_task_snapshots(task_id)
);

CREATE INDEX IF NOT EXISTS idx_nexus_task_events_scope
  ON nexus_task_events(scope_key, environment, task_id, revision);

CREATE TABLE IF NOT EXISTS nexus_audit_ledger_heads (
  scope_key TEXT NOT NULL,
  tenant_id TEXT,
  environment TEXT NOT NULL CHECK (environment IN ('preview','development','test')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  head_hash TEXT NOT NULL CHECK (length(head_hash) = 64 AND head_hash NOT GLOB '*[^a-fA-F0-9]*'),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (scope_key, environment),
  CHECK (scope_key = COALESCE(tenant_id, '__GLOBAL__'))
);

CREATE TABLE IF NOT EXISTS nexus_audit_ledger_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  scope_key TEXT NOT NULL,
  tenant_id TEXT,
  environment TEXT NOT NULL CHECK (environment IN ('preview','development','test')),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  previous_hash TEXT NOT NULL CHECK (length(previous_hash) = 64 AND previous_hash NOT GLOB '*[^a-fA-F0-9]*'),
  hash TEXT NOT NULL CHECK (length(hash) = 64 AND hash NOT GLOB '*[^a-fA-F0-9]*'),
  event_json TEXT NOT NULL CHECK (json_valid(event_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (scope_key, environment, sequence),
  CHECK (scope_key = COALESCE(tenant_id, '__GLOBAL__'))
);

CREATE INDEX IF NOT EXISTS idx_nexus_audit_events_scope
  ON nexus_audit_ledger_events(scope_key, environment, sequence);

-- The first statement in the atomic batch inserts ok=1 only if both previous
-- snapshots match. CHECK(ok=1) aborts the entire batch on stale/replay/race.
CREATE TABLE IF NOT EXISTS nexus_task_commit_guards (
  commit_id TEXT PRIMARY KEY NOT NULL,
  ok INTEGER NOT NULL CHECK (ok = 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_nexus_task_snapshot_revision
BEFORE UPDATE ON nexus_task_snapshots
WHEN NEW.revision != OLD.revision + 1
  OR NEW.task_id != OLD.task_id
  OR NEW.tenant_id IS NOT OLD.tenant_id
  OR NEW.scope_key != OLD.scope_key
  OR NEW.environment != OLD.environment
BEGIN
  SELECT RAISE(ABORT, 'NEXUS_TASK_REVISION_OR_SCOPE_INVALID');
END;

CREATE TRIGGER IF NOT EXISTS trg_nexus_task_events_no_update
BEFORE UPDATE ON nexus_task_events
BEGIN
  SELECT RAISE(ABORT, 'NEXUS_TASK_EVENTS_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_nexus_task_events_no_delete
BEFORE DELETE ON nexus_task_events
BEGIN
  SELECT RAISE(ABORT, 'NEXUS_TASK_EVENTS_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_nexus_audit_head_revision
BEFORE UPDATE ON nexus_audit_ledger_heads
WHEN NEW.revision != OLD.revision + 1
  OR NEW.scope_key != OLD.scope_key
  OR NEW.tenant_id IS NOT OLD.tenant_id
  OR NEW.environment != OLD.environment
BEGIN
  SELECT RAISE(ABORT, 'NEXUS_AUDIT_HEAD_REVISION_OR_SCOPE_INVALID');
END;

CREATE TRIGGER IF NOT EXISTS trg_nexus_audit_events_no_update
BEFORE UPDATE ON nexus_audit_ledger_events
BEGIN
  SELECT RAISE(ABORT, 'NEXUS_AUDIT_EVENTS_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_nexus_audit_events_no_delete
BEFORE DELETE ON nexus_audit_ledger_events
BEGIN
  SELECT RAISE(ABORT, 'NEXUS_AUDIT_EVENTS_APPEND_ONLY');
END;
