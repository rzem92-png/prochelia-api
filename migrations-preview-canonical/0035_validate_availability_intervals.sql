-- PROCHÉLIA — reject malformed or non-positive availability intervals.
-- julianday() returns NULL for malformed timestamps; overlap comparisons alone
-- would then evaluate to NULL and silently skip the conflict guard.
-- Only active availability rows are constrained; historical/non-available rows
-- remain untouched. Valid timestamps may use explicit timezone offsets.
CREATE TRIGGER IF NOT EXISTS trg_disponibilites_valid_interval_insert
BEFORE INSERT ON disponibilites
WHEN NEW.status = 'available' AND (
  julianday(NEW.start_at) IS NULL
  OR julianday(NEW.end_at) IS NULL
  OR julianday(NEW.end_at) <= julianday(NEW.start_at)
)
BEGIN
  SELECT RAISE(ABORT, 'AVAILABILITY_INTERVAL_INVALID');
END;

CREATE TRIGGER IF NOT EXISTS trg_disponibilites_valid_interval_update
BEFORE UPDATE OF start_at, end_at, status ON disponibilites
WHEN NEW.status = 'available' AND (
  julianday(NEW.start_at) IS NULL
  OR julianday(NEW.end_at) IS NULL
  OR julianday(NEW.end_at) <= julianday(NEW.start_at)
)
BEGIN
  SELECT RAISE(ABORT, 'AVAILABILITY_INTERVAL_INVALID');
END;
