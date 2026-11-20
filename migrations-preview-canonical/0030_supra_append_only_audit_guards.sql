-- PROCHÉLIA — repair append-only guards for deployed Nexus Supra audit/approval tables.
-- This canonical Preview migration follows tenant/accounting migrations 0023–0029.
-- It is additive and does not rewrite existing rows or enable business execution.

CREATE TRIGGER IF NOT EXISTS trg_supra_audit_events_no_update
BEFORE UPDATE ON supra_audit_events
BEGIN
  SELECT RAISE(ABORT, 'SUPRA_AUDIT_EVENTS_ARE_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_supra_audit_events_no_delete
BEFORE DELETE ON supra_audit_events
BEGIN
  SELECT RAISE(ABORT, 'SUPRA_AUDIT_EVENTS_ARE_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS trg_supra_approval_requests_no_delete
BEFORE DELETE ON supra_approval_requests
BEGIN
  SELECT RAISE(ABORT, 'APPROVAL_REQUESTS_ARE_APPEND_ONLY');
END;
