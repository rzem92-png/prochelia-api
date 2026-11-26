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
