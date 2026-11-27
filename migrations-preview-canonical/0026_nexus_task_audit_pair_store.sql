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
  event_json TEXT NOT NULL CHECK (json_valid(event_json) AND json_extract(event_json, '$.executionAllowed') = 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (scope_key, environment, sequence),
  CHECK (scope_key = COALESCE(tenant_id, '__GLOBAL__'))
);

CREATE INDEX IF NOT EXISTS idx_nexus_audit_events_scope
  ON nexus_audit_ledger_events(scope_key, environment, sequence);

-- CHECK(ok=1) aborts the batch when either expected previous snapshot is stale.
CREATE TABLE IF NOT EXISTS nexus_task_commit_guards (
  commit_id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('preview','development','test')),
  task_revision INTEGER NOT NULL CHECK (task_revision >= 1),
  audit_revision INTEGER NOT NULL CHECK (audit_revision >= 1),
  ok INTEGER NOT NULL CHECK (ok = 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_nexus_task_snapshot_insert_guard
BEFORE INSERT ON nexus_task_snapshots
WHEN NOT EXISTS (SELECT 1 FROM nexus_task_commit_guards
  WHERE task_id=NEW.task_id AND scope_key=NEW.scope_key AND environment=NEW.environment AND task_revision=NEW.revision)
BEGIN
  SELECT RAISE(ABORT, 'NEXUS_TASK_COMMIT_GUARD_REQUIRED');
END;

CREATE TRIGGER IF NOT EXISTS trg_nexus_task_snapshot_revision
BEFORE UPDATE ON nexus_task_snapshots
WHEN NEW.revision != OLD.revision + 1
  OR NEW.task_id != OLD.task_id
  OR NEW.tenant_id IS NOT OLD.tenant_id
  OR NEW.scope_key != OLD.scope_key
  OR NEW.environment != OLD.environment
  OR NOT EXISTS (SELECT 1 FROM nexus_task_commit_guards
    WHERE task_id=NEW.task_id AND scope_key=NEW.scope_key AND environment=NEW.environment AND task_revision=NEW.revision)
BEGIN
  SELECT RAISE(ABORT, 'NEXUS_TASK_REVISION_OR_SCOPE_INVALID');
END;

CREATE TRIGGER IF NOT EXISTS trg_nexus_task_events_guard
BEFORE INSERT ON nexus_task_events
WHEN NOT EXISTS (SELECT 1 FROM nexus_task_commit_guards
    WHERE task_id=NEW.task_id AND scope_key=NEW.scope_key AND environment=NEW.environment AND task_revision=NEW.revision)
  OR NOT EXISTS (SELECT 1 FROM nexus_task_snapshots
    WHERE task_id=NEW.task_id AND tenant_id IS NEW.tenant_id AND scope_key=NEW.scope_key AND environment=NEW.environment AND revision=NEW.revision)
  OR json_extract(NEW.event_json,'$.eventId') IS NOT NEW.event_id
  OR json_extract(NEW.event_json,'$.taskId') IS NOT NEW.task_id
  OR json_extract(NEW.event_json,'$.tenantId') IS NOT NEW.tenant_id
  OR json_extract(NEW.event_json,'$.environment') IS NOT NEW.environment
  OR json_extract(NEW.event_json,'$.revision') IS NOT NEW.revision
BEGIN
  SELECT RAISE(ABORT, 'NEXUS_TASK_EVENT_CONTRACT_INVALID');
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

CREATE TRIGGER IF NOT EXISTS trg_nexus_audit_event_chain_guard
BEFORE INSERT ON nexus_audit_ledger_events
WHEN NOT EXISTS (SELECT 1 FROM nexus_task_commit_guards
    WHERE scope_key=NEW.scope_key AND environment=NEW.environment AND audit_revision=NEW.sequence)
  OR NOT (
    (NEW.sequence=1 AND NOT EXISTS (SELECT 1 FROM nexus_audit_ledger_heads WHERE scope_key=NEW.scope_key AND environment=NEW.environment)
      AND NEW.previous_hash='0000000000000000000000000000000000000000000000000000000000000000')
    OR EXISTS (SELECT 1 FROM nexus_audit_ledger_heads
      WHERE scope_key=NEW.scope_key AND environment=NEW.environment AND revision=NEW.sequence-1 AND head_hash=NEW.previous_hash)
  )
  OR json_extract(NEW.event_json,'$.eventId') IS NOT NEW.event_id
  OR json_extract(NEW.event_json,'$.sequence') IS NOT NEW.sequence
  OR json_extract(NEW.event_json,'$.previousHash') IS NOT NEW.previous_hash
  OR json_extract(NEW.event_json,'$.hash') IS NOT NEW.hash
  OR json_extract(NEW.event_json,'$.environment') IS NOT NEW.environment
  OR json_extract(NEW.event_json,'$.tenantId') IS NOT NEW.tenant_id
  OR json_extract(NEW.event_json,'$.executionAllowed') IS NOT 0
BEGIN
  SELECT RAISE(ABORT, 'NEXUS_AUDIT_EVENT_CHAIN_INVALID');
END;

CREATE TRIGGER IF NOT EXISTS trg_nexus_audit_head_insert_guard
BEFORE INSERT ON nexus_audit_ledger_heads
WHEN NOT EXISTS (SELECT 1 FROM nexus_task_commit_guards
    WHERE scope_key=NEW.scope_key AND environment=NEW.environment AND audit_revision=NEW.revision)
  OR NOT EXISTS (SELECT 1 FROM nexus_audit_ledger_events
    WHERE scope_key=NEW.scope_key AND environment=NEW.environment AND sequence=NEW.revision AND hash=NEW.head_hash AND tenant_id IS NEW.tenant_id)
BEGIN
  SELECT RAISE(ABORT, 'NEXUS_AUDIT_HEAD_EVENT_REQUIRED');
END;

CREATE TRIGGER IF NOT EXISTS trg_nexus_audit_head_revision
BEFORE UPDATE ON nexus_audit_ledger_heads
WHEN NEW.revision != OLD.revision + 1
  OR NEW.scope_key != OLD.scope_key
  OR NEW.tenant_id IS NOT OLD.tenant_id
  OR NEW.environment != OLD.environment
  OR NOT EXISTS (SELECT 1 FROM nexus_task_commit_guards
    WHERE scope_key=NEW.scope_key AND environment=NEW.environment AND audit_revision=NEW.revision)
  OR NOT EXISTS (SELECT 1 FROM nexus_audit_ledger_events
    WHERE scope_key=NEW.scope_key AND environment=NEW.environment AND sequence=NEW.revision AND hash=NEW.head_hash AND tenant_id IS NEW.tenant_id)
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
