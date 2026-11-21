-- PROCHÉLIA — tenant isolation for support cases.
-- Existing legacy cases remain unassigned (tenant_id NULL) and are deliberately
-- invisible until an authorized, audited migration maps them to their true tenant.
ALTER TABLE support_cases ADD COLUMN tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_support_cases_tenant_status_created
  ON support_cases(tenant_id, status, severity, created_at);

CREATE INDEX IF NOT EXISTS idx_support_cases_tenant_requester_created
  ON support_cases(tenant_id, requester_id, created_at);
