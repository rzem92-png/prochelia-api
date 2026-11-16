-- Nexus Supra audit trail. Execution is intentionally hard-disabled at schema level.
CREATE TABLE IF NOT EXISTS supra_audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  event_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  action TEXT NOT NULL,
  risk TEXT NOT NULL CHECK (risk IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  approval_required INTEGER NOT NULL CHECK (approval_required IN (0, 1)),
  execution_allowed INTEGER NOT NULL DEFAULT 0 CHECK (execution_allowed = 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_supra_audit_events_created_at ON supra_audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_supra_audit_events_actor ON supra_audit_events(actor_user_id, created_at);
