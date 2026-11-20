-- PROCHÉLIA — tenant attribution for every new Nexus Supra audit event.
-- Existing historical rows remain readable with NULL tenant_id; all new rows must
-- reference an active tenant. No business execution or data rewrite is performed.
ALTER TABLE supra_audit_events
  ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_supra_audit_events_tenant_created_at
  ON supra_audit_events(tenant_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_supra_audit_events_require_active_tenant
BEFORE INSERT ON supra_audit_events
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t WHERE t.id = NEW.tenant_id AND t.status = 'ACTIVE'
)
BEGIN
  SELECT RAISE(ABORT, 'SUPRA_AUDIT_ACTIVE_TENANT_REQUIRED');
END;
