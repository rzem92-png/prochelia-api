-- Persisted, action-bound human approvals for Nexus Supra.
-- Additive only. No executor is enabled by this migration.

CREATE TABLE IF NOT EXISTS supra_approval_requests (
  id TEXT PRIMARY KEY NOT NULL,
  requester_user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  payload_json TEXT NOT NULL,
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  currency TEXT,
  reason TEXT NOT NULL,
  risk TEXT NOT NULL CHECK (risk IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  required_approvals INTEGER NOT NULL CHECK (required_approvals IN (1, 2)),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED', 'CONSUMED')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  consumed_at TEXT,
  consumed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_supra_approval_requests_status_expiry
  ON supra_approval_requests(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_supra_approval_requests_tenant_resource
  ON supra_approval_requests(tenant_id, resource_id, action);

CREATE TABLE IF NOT EXISTS supra_approval_votes (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL,
  approver_user_id TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'REJECT')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES supra_approval_requests(id),
  UNIQUE (request_id, approver_user_id)
);

CREATE INDEX IF NOT EXISTS idx_supra_approval_votes_request
  ON supra_approval_votes(request_id, decision);

CREATE TABLE IF NOT EXISTS supra_approval_events (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('REQUESTED', 'VOTE_RECORDED', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED', 'CONSUMED', 'CONSUME_DENIED')),
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES supra_approval_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_supra_approval_events_request
  ON supra_approval_events(request_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_supra_approval_requests_immutable
BEFORE UPDATE OF requester_user_id, tenant_id, action, resource_id, payload_hash,
  amount_cents, currency, reason, risk, required_approvals, expires_at, created_at, payload_json
ON supra_approval_requests
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_APPROVAL_REQUEST_FIELDS');
END;

CREATE TRIGGER IF NOT EXISTS trg_supra_approval_votes_no_update
BEFORE UPDATE ON supra_approval_votes
BEGIN
  SELECT RAISE(ABORT, 'APPROVAL_VOTES_ARE_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_supra_approval_votes_no_delete
BEFORE DELETE ON supra_approval_votes
BEGIN
  SELECT RAISE(ABORT, 'APPROVAL_VOTES_ARE_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_supra_approval_events_no_update
BEFORE UPDATE ON supra_approval_events
BEGIN
  SELECT RAISE(ABORT, 'APPROVAL_EVENTS_ARE_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_supra_approval_events_no_delete
BEFORE DELETE ON supra_approval_events
BEGIN
  SELECT RAISE(ABORT, 'APPROVAL_EVENTS_ARE_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_supra_approval_status_transitions
BEFORE UPDATE OF status ON supra_approval_requests
WHEN NOT (
  (OLD.status = 'PENDING' AND NEW.status IN ('APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED')) OR
  (OLD.status = 'APPROVED' AND NEW.status IN ('CONSUMED', 'REVOKED'))
)
BEGIN
  SELECT RAISE(ABORT, 'INVALID_APPROVAL_STATUS_TRANSITION');
END;

CREATE TRIGGER IF NOT EXISTS trg_supra_approval_status_evidence
BEFORE UPDATE OF status ON supra_approval_requests
WHEN
  (NEW.status IN ('APPROVED', 'CONSUMED') AND
    (NEW.approved_at IS NULL OR
     (SELECT COUNT(*) FROM supra_approval_votes
       WHERE request_id = NEW.id AND decision = 'APPROVE') < NEW.required_approvals))
  OR
  (NEW.status = 'CONSUMED' AND (NEW.consumed_at IS NULL OR NEW.consumed_by IS NULL))
BEGIN
  SELECT RAISE(ABORT, 'APPROVAL_STATUS_EVIDENCE_MISSING');
END;
