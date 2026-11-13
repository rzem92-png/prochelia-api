-- PROCHÉLIA — persistent, action-bound SUPRA approvals.
-- Additive schema: no existing business data is modified.
CREATE TABLE IF NOT EXISTS supra_action_approvals (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action_digest TEXT NOT NULL,
  approver_user_id TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('EXECUTING','CONSUMED','FAILED')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supra_approvals_case
  ON supra_action_approvals(case_id, created_at);

CREATE INDEX IF NOT EXISTS idx_supra_approvals_status_expiry
  ON supra_action_approvals(status, expires_at);
