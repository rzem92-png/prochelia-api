-- PROCHÉLIA — durable idempotency for intervenant availability writes.
-- A retry after a lost HTTP response must return the original slot instead of
-- creating a second row. The key is scoped to the authenticated tenant/profile.
ALTER TABLE disponibilites ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_disponibilites_tenant_intervenant_idempotency
  ON disponibilites(tenant_id, intervenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
