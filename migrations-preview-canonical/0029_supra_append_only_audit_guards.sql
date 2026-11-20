-- PROCHÉLIA — repair append-only guards for deployed Nexus Supra audit/approval tables.
-- This migration follows the accounting/tenant chain 0023–0028.
-- It is additive and does not enable business execution or mutate existing rows.

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
