-- PROCHÉLIA — tenant isolation and append-only history for mission security records.
-- Existing rows are deliberately left tenant_id NULL. They remain inaccessible to
-- tenant-scoped handlers until an explicitly reviewed attribution procedure is approved.
-- No data is backfilled or deleted by this migration.

ALTER TABLE mission_security
  ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

ALTER TABLE mission_security_attempts
  ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

ALTER TABLE security_audit
  ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_mission_security_tenant_mission
  ON mission_security(tenant_id, mission_id, status);

CREATE INDEX IF NOT EXISTS idx_mission_security_attempts_tenant_security
  ON mission_security_attempts(tenant_id, security_id, created_at);

CREATE INDEX IF NOT EXISTS idx_security_audit_tenant_created
  ON security_audit(tenant_id, created_at, id);

-- A mission-security record must belong to the same active tenant as its mission,
-- client and intervenant. Caller-provided tenant identifiers are not sufficient.
CREATE TRIGGER IF NOT EXISTS trg_mission_security_tenant_insert
BEFORE INSERT ON mission_security
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1
  FROM tenants t
  JOIN missions m
    ON m.id = NEW.mission_id
   AND m.tenant_id = t.id
   AND m.client_id = NEW.client_id
   AND m.intervenant_id = NEW.intervenant_id
  JOIN clients c
    ON c.id = NEW.client_id
   AND c.tenant_id = t.id
  JOIN intervenants i
    ON i.id = NEW.intervenant_id
   AND i.tenant_id = t.id
  WHERE t.id = NEW.tenant_id
    AND t.status = 'ACTIVE'
)
BEGIN
  SELECT RAISE(ABORT, 'MISSION_SECURITY_TENANT_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_mission_security_tenant_update
BEFORE UPDATE OF tenant_id, mission_id, client_id, intervenant_id ON mission_security
WHEN NEW.tenant_id IS NULL
  OR (OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS NOT OLD.tenant_id)
  OR NOT EXISTS (
    SELECT 1
    FROM tenants t
    JOIN missions m
      ON m.id = NEW.mission_id
     AND m.tenant_id = t.id
     AND m.client_id = NEW.client_id
     AND m.intervenant_id = NEW.intervenant_id
    JOIN clients c
      ON c.id = NEW.client_id
     AND c.tenant_id = t.id
    JOIN intervenants i
      ON i.id = NEW.intervenant_id
     AND i.tenant_id = t.id
    WHERE t.id = NEW.tenant_id
      AND t.status = 'ACTIVE'
  )
BEGIN
  SELECT RAISE(ABORT, 'MISSION_SECURITY_TENANT_MISMATCH');
END;

-- Legacy rows with no proven tenant attribution cannot be changed or deleted
-- through ordinary application paths.
CREATE TRIGGER IF NOT EXISTS trg_mission_security_unscoped_no_update
BEFORE UPDATE ON mission_security
WHEN OLD.tenant_id IS NULL OR NEW.tenant_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'MISSION_SECURITY_TENANT_ATTRIBUTION_REQUIRED');
END;

CREATE TRIGGER IF NOT EXISTS trg_mission_security_unscoped_no_delete
BEFORE DELETE ON mission_security
WHEN OLD.tenant_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'MISSION_SECURITY_TENANT_ATTRIBUTION_REQUIRED');
END;

-- Attempt records must point to a security record in the same active tenant.
-- Actor identities, when present, must have an active membership in that tenant.
CREATE TRIGGER IF NOT EXISTS trg_mission_security_attempts_tenant_insert
BEFORE INSERT ON mission_security_attempts
WHEN NEW.tenant_id IS NULL
  OR NOT EXISTS (
    SELECT 1
    FROM tenants t
    JOIN mission_security s
      ON s.id = NEW.security_id
     AND s.tenant_id = t.id
    WHERE t.id = NEW.tenant_id
      AND t.status = 'ACTIVE'
  )
  OR (NEW.actor_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM tenant_memberships m
    WHERE m.user_id = NEW.actor_user_id
      AND m.tenant_id = NEW.tenant_id
      AND m.status = 'ACTIVE'
  ))
BEGIN
  SELECT RAISE(ABORT, 'MISSION_SECURITY_ATTEMPT_TENANT_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_mission_security_attempts_no_update
BEFORE UPDATE ON mission_security_attempts
BEGIN
  SELECT RAISE(ABORT, 'MISSION_SECURITY_ATTEMPTS_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_mission_security_attempts_no_delete
BEFORE DELETE ON mission_security_attempts
BEGIN
  SELECT RAISE(ABORT, 'MISSION_SECURITY_ATTEMPTS_APPEND_ONLY');
END;

-- Security audit events are tenant-scoped and append-only.
-- System-generated events may have no actor; human actors require active membership.
CREATE TRIGGER IF NOT EXISTS trg_security_audit_tenant_insert
BEFORE INSERT ON security_audit
WHEN NEW.tenant_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM tenants t
    WHERE t.id = NEW.tenant_id
      AND t.status = 'ACTIVE'
  )
  OR (NEW.user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM tenant_memberships m
    WHERE m.user_id = NEW.user_id
      AND m.tenant_id = NEW.tenant_id
      AND m.status = 'ACTIVE'
  ))
BEGIN
  SELECT RAISE(ABORT, 'SECURITY_AUDIT_TENANT_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_security_audit_no_update
BEFORE UPDATE ON security_audit
BEGIN
  SELECT RAISE(ABORT, 'SECURITY_AUDIT_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_security_audit_no_delete
BEFORE DELETE ON security_audit
BEGIN
  SELECT RAISE(ABORT, 'SECURITY_AUDIT_APPEND_ONLY');
END;
