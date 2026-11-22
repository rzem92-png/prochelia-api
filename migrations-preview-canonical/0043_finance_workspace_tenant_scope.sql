-- PROCHÉLIA — tenant scope for finance workspace, exports and resolution cases.
-- Legacy records stay unassigned until a valid user/tenant membership is verified.
-- Runtime finance schema helpers validate this migration and never create tables.

CREATE TABLE IF NOT EXISTS finance_workspace_entries (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL,
  entry_type TEXT NOT NULL, direction TEXT NOT NULL DEFAULT 'IN',
  amount_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'EUR',
  label TEXT, reference_type TEXT, reference_id TEXT,
  status TEXT NOT NULL DEFAULT 'posted', metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS finance_export_log (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL, format TEXT NOT NULL,
  period_start TEXT, period_end TEXT, row_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS finance_resolution_cases (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL, issue_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN', severity TEXT NOT NULL DEFAULT 'LOW',
  description TEXT, proposed_solution TEXT, resolution TEXT, amount_cents INTEGER,
  reference_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT
);

ALTER TABLE finance_workspace_entries ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE finance_export_log ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE finance_resolution_cases ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_finance_workspace_user ON finance_workspace_entries(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_workspace_ref ON finance_workspace_entries(reference_type,reference_id);
CREATE INDEX IF NOT EXISTS idx_finance_workspace_tenant_created ON finance_workspace_entries(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_workspace_tenant_user_created ON finance_workspace_entries(tenant_id,user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_export_user ON finance_export_log(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_export_tenant_created ON finance_export_log(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_resolution_user ON finance_resolution_cases(user_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_resolution_tenant_status_created ON finance_resolution_cases(tenant_id,status,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_finance_workspace_entry_tenant_insert
BEFORE INSERT ON finance_workspace_entries
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN tenant_memberships m ON m.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND m.user_id=NEW.user_id AND m.status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT,'FINANCE_ENTRY_ACTIVE_TENANT_MEMBERSHIP_REQUIRED'); END;
CREATE TRIGGER IF NOT EXISTS trg_finance_workspace_entry_tenant_update
BEFORE UPDATE OF tenant_id ON finance_workspace_entries
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN tenant_memberships m ON m.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND m.user_id=NEW.user_id AND m.status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT,'FINANCE_ENTRY_ACTIVE_TENANT_MEMBERSHIP_REQUIRED'); END;
DROP TRIGGER IF EXISTS trg_finance_workspace_entry_no_update;
CREATE TRIGGER IF NOT EXISTS trg_finance_workspace_entry_no_update
BEFORE UPDATE ON finance_workspace_entries
WHEN OLD.tenant_id IS NOT NULL
  OR NEW.id IS NOT OLD.id OR NEW.user_id IS NOT OLD.user_id OR NEW.role IS NOT OLD.role
  OR NEW.entry_type IS NOT OLD.entry_type OR NEW.direction IS NOT OLD.direction
  OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.currency IS NOT OLD.currency
  OR NEW.label IS NOT OLD.label OR NEW.reference_type IS NOT OLD.reference_type
  OR NEW.reference_id IS NOT OLD.reference_id OR NEW.status IS NOT OLD.status
  OR NEW.metadata_json IS NOT OLD.metadata_json OR NEW.created_at IS NOT OLD.created_at
  OR NEW.updated_at IS NOT OLD.updated_at OR NEW.tenant_id IS NULL
BEGIN SELECT RAISE(ABORT,'FINANCE_ENTRY_APPEND_ONLY'); END;
CREATE TRIGGER IF NOT EXISTS trg_finance_workspace_entry_no_delete
BEFORE DELETE ON finance_workspace_entries
BEGIN SELECT RAISE(ABORT,'FINANCE_ENTRY_APPEND_ONLY'); END;

CREATE TRIGGER IF NOT EXISTS trg_finance_export_tenant_insert
BEFORE INSERT ON finance_export_log
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN tenant_memberships m ON m.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND m.user_id=NEW.user_id AND m.status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT,'FINANCE_EXPORT_ACTIVE_TENANT_MEMBERSHIP_REQUIRED'); END;
CREATE TRIGGER IF NOT EXISTS trg_finance_export_tenant_update
BEFORE UPDATE OF tenant_id ON finance_export_log
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN tenant_memberships m ON m.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND m.user_id=NEW.user_id AND m.status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT,'FINANCE_EXPORT_ACTIVE_TENANT_MEMBERSHIP_REQUIRED'); END;
DROP TRIGGER IF EXISTS trg_finance_export_no_update;
CREATE TRIGGER IF NOT EXISTS trg_finance_export_no_update
BEFORE UPDATE ON finance_export_log
WHEN OLD.tenant_id IS NOT NULL
  OR NEW.id IS NOT OLD.id OR NEW.user_id IS NOT OLD.user_id OR NEW.role IS NOT OLD.role
  OR NEW.format IS NOT OLD.format OR NEW.period_start IS NOT OLD.period_start
  OR NEW.period_end IS NOT OLD.period_end OR NEW.row_count IS NOT OLD.row_count
  OR NEW.created_at IS NOT OLD.created_at OR NEW.tenant_id IS NULL
BEGIN SELECT RAISE(ABORT,'FINANCE_EXPORT_APPEND_ONLY'); END;
CREATE TRIGGER IF NOT EXISTS trg_finance_export_no_delete
BEFORE DELETE ON finance_export_log
BEGIN SELECT RAISE(ABORT,'FINANCE_EXPORT_APPEND_ONLY'); END;

CREATE TRIGGER IF NOT EXISTS trg_finance_resolution_tenant_insert
BEFORE INSERT ON finance_resolution_cases
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN tenant_memberships m ON m.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND m.user_id=NEW.user_id AND m.status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT,'FINANCE_CASE_ACTIVE_TENANT_MEMBERSHIP_REQUIRED'); END;
CREATE TRIGGER IF NOT EXISTS trg_finance_resolution_tenant_update
BEFORE UPDATE OF tenant_id,user_id ON finance_resolution_cases
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN tenant_memberships m ON m.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND m.user_id=NEW.user_id AND m.status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT,'FINANCE_CASE_ACTIVE_TENANT_MEMBERSHIP_REQUIRED'); END;
CREATE TRIGGER IF NOT EXISTS trg_finance_resolution_identity_immutable
BEFORE UPDATE OF tenant_id,user_id,issue_type,reference_id ON finance_resolution_cases
WHEN (OLD.tenant_id IS NOT NULL AND NEW.tenant_id <> OLD.tenant_id)
  OR NEW.user_id <> OLD.user_id OR NEW.issue_type <> OLD.issue_type
  OR NEW.reference_id IS NOT OLD.reference_id
BEGIN SELECT RAISE(ABORT,'FINANCE_CASE_IDENTITY_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_finance_resolution_no_delete
BEFORE DELETE ON finance_resolution_cases
BEGIN SELECT RAISE(ABORT,'FINANCE_CASE_HISTORY_IMMUTABLE'); END;
