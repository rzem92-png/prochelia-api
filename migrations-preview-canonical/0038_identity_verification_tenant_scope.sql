-- PROCHÉLIA — tenant isolation for identity verification decisions.
-- Additive only: legacy records remain NULL and cannot authorize a mission until
-- explicitly attributed through a separately audited process.
ALTER TABLE identity_verifications
  ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_tenant_user_status
  ON identity_verifications(tenant_id, user_id, status, updated_at);
