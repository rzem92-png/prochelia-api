-- PROCHÉLIA — idempotent repair of append-only SUPRA audit/approval guards.
-- Sequence 0030 follows the canonical accounting/tenant chain through 0029.
-- This is additive only: no business execution, financial action, or row rewrite.

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
