-- PROCHÉLIA — database-enforced non-overlapping provider availability.
-- This closes the concurrent-request race left by application-level preflight checks.
CREATE INDEX IF NOT EXISTS idx_disponibilites_tenant_provider_window
  ON disponibilites(tenant_id, intervenant_id, status, start_at, end_at);

CREATE TRIGGER IF NOT EXISTS trg_disponibilites_no_overlap_insert
BEFORE INSERT ON disponibilites
WHEN NEW.status = 'available' AND EXISTS (
  SELECT 1
    FROM disponibilites existing
   WHERE existing.tenant_id = NEW.tenant_id
     AND existing.intervenant_id = NEW.intervenant_id
     AND existing.status = 'available'
     AND existing.start_at < NEW.end_at
     AND existing.end_at > NEW.start_at
)
BEGIN
  SELECT RAISE(ABORT, 'AVAILABILITY_OVERLAP');
END;

CREATE TRIGGER IF NOT EXISTS trg_disponibilites_no_overlap_update
BEFORE UPDATE OF start_at, end_at, status, tenant_id, intervenant_id ON disponibilites
WHEN NEW.status = 'available' AND EXISTS (
  SELECT 1
    FROM disponibilites existing
   WHERE existing.id <> OLD.id
     AND existing.tenant_id = NEW.tenant_id
     AND existing.intervenant_id = NEW.intervenant_id
     AND existing.status = 'available'
     AND existing.start_at < NEW.end_at
     AND existing.end_at > NEW.start_at
)
BEGIN
  SELECT RAISE(ABORT, 'AVAILABILITY_OVERLAP');
END;
