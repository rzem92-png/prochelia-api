-- PROCHÉLIA — timezone-safe availability overlap guard.
-- Compare parsed instants rather than ISO strings, whose lexical order is not
-- chronological when offsets differ (for example +02:00 versus Z).
DROP TRIGGER IF EXISTS trg_disponibilites_no_overlap_insert;
DROP TRIGGER IF EXISTS trg_disponibilites_no_overlap_update;

CREATE TRIGGER trg_disponibilites_no_overlap_insert
BEFORE INSERT ON disponibilites
WHEN NEW.status = 'available' AND EXISTS (
  SELECT 1
    FROM disponibilites existing
   WHERE existing.tenant_id = NEW.tenant_id
     AND existing.intervenant_id = NEW.intervenant_id
     AND existing.status = 'available'
     AND julianday(existing.start_at) < julianday(NEW.end_at)
     AND julianday(existing.end_at) > julianday(NEW.start_at)
)
BEGIN
  SELECT RAISE(ABORT, 'AVAILABILITY_OVERLAP');
END;

CREATE TRIGGER trg_disponibilites_no_overlap_update
BEFORE UPDATE OF start_at, end_at, status, tenant_id, intervenant_id ON disponibilites
WHEN NEW.status = 'available' AND EXISTS (
  SELECT 1
    FROM disponibilites existing
   WHERE existing.id <> OLD.id
     AND existing.tenant_id = NEW.tenant_id
     AND existing.intervenant_id = NEW.intervenant_id
     AND existing.status = 'available'
     AND julianday(existing.start_at) < julianday(NEW.end_at)
     AND julianday(existing.end_at) > julianday(NEW.start_at)
)
BEGIN
  SELECT RAISE(ABORT, 'AVAILABILITY_OVERLAP');
END;
