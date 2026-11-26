-- PROCHÉLIA — idempotent API creation for provider unavailability.
-- Additive only. Keys are tenant/provider scoped; null keeps compatibility for
-- records created before the API is wired.
ALTER TABLE provider_unavailability ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX idx_provider_unavailability_idempotency
  ON provider_unavailability(tenant_id, intervenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
