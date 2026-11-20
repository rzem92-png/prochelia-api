-- Harden the already-deployed Preview Nexus Supra audit and approval records.
-- Additive repair for databases where migrations 0021 and 0022 are already recorded.
-- No business execution is enabled by this migration.

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
