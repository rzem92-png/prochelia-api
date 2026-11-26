-- PROCHÉLIA — server-authoritative provider unavailability (schema foundation).
-- All timestamps must be stored as UTC ISO-8601; timezone_name records the user's
-- declared IANA zone for display/recurrence interpretation. API enforcement follows separately.
CREATE TABLE provider_unavailability (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  intervenant_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  timezone_name TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'CANCELLED')),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(reason) <= 120),
  CHECK (start_at < end_at),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (intervenant_id) REFERENCES intervenants(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_provider_unavailability_tenant_provider_time
  ON provider_unavailability(tenant_id, intervenant_id, status, start_at, end_at);
CREATE INDEX idx_provider_unavailability_tenant_range
  ON provider_unavailability(tenant_id, status, start_at, end_at);

-- Prevent assigning a provider's block to a different tenant.
CREATE TRIGGER trg_provider_unavailability_tenant_match_insert
BEFORE INSERT ON provider_unavailability
WHEN NOT EXISTS (
  SELECT 1 FROM intervenants i
   WHERE i.id = NEW.intervenant_id AND i.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'PROVIDER_TENANT_MISMATCH');
END;

CREATE TRIGGER trg_provider_unavailability_tenant_match_update
BEFORE UPDATE OF tenant_id, intervenant_id ON provider_unavailability
WHEN NOT EXISTS (
  SELECT 1 FROM intervenants i
   WHERE i.id = NEW.intervenant_id AND i.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'PROVIDER_TENANT_MISMATCH');
END;

-- Server-side overlap protection; adjacent intervals are allowed.
CREATE TRIGGER trg_provider_unavailability_no_overlap_insert
BEFORE INSERT ON provider_unavailability
WHEN NEW.status = 'ACTIVE' AND EXISTS (
  SELECT 1 FROM provider_unavailability p
   WHERE p.tenant_id = NEW.tenant_id
     AND p.intervenant_id = NEW.intervenant_id
     AND p.status = 'ACTIVE'
     AND p.start_at < NEW.end_at
     AND p.end_at > NEW.start_at
)
BEGIN
  SELECT RAISE(ABORT, 'PROVIDER_UNAVAILABILITY_OVERLAP');
END;

CREATE TRIGGER trg_provider_unavailability_no_overlap_update
BEFORE UPDATE OF tenant_id, intervenant_id, start_at, end_at, status ON provider_unavailability
WHEN NEW.status = 'ACTIVE' AND EXISTS (
  SELECT 1 FROM provider_unavailability p
   WHERE p.id <> NEW.id
     AND p.tenant_id = NEW.tenant_id
     AND p.intervenant_id = NEW.intervenant_id
     AND p.status = 'ACTIVE'
     AND p.start_at < NEW.end_at
     AND p.end_at > NEW.start_at
)
BEGIN
  SELECT RAISE(ABORT, 'PROVIDER_UNAVAILABILITY_OVERLAP');
END;
