-- PROCHÉLIA — explicit, terminal session revocation and audit metadata.
-- Additive auth hardening; runtime logout/rotation handlers must use these fields.
ALTER TABLE sessions ADD COLUMN revoked_at TEXT;
ALTER TABLE sessions ADD COLUMN revoked_reason TEXT;
ALTER TABLE sessions ADD COLUMN revoked_by_user_id TEXT REFERENCES users(id);
ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;
ALTER TABLE sessions ADD COLUMN active_tenant_id TEXT REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_active_expiry
  ON sessions(user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_revoked_at
  ON sessions(revoked_at)
  WHERE revoked_at IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_session_identity_immutable
BEFORE UPDATE OF id, user_id, token_hash ON sessions
WHEN NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id OR NEW.token_hash <> OLD.token_hash
BEGIN
  SELECT RAISE(ABORT, 'SESSION_IDENTITY_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_session_revocation_terminal
BEFORE UPDATE ON sessions
WHEN OLD.revoked_at IS NOT NULL AND (
  NEW.revoked_at IS NULL OR
  NEW.revoked_at <> OLD.revoked_at OR
  COALESCE(NEW.revoked_reason, '') <> COALESCE(OLD.revoked_reason, '') OR
  COALESCE(NEW.revoked_by_user_id, '') <> COALESCE(OLD.revoked_by_user_id, '')
)
BEGIN
  SELECT RAISE(ABORT, 'SESSION_REVOCATION_TERMINAL');
END;

CREATE TRIGGER IF NOT EXISTS trg_session_revocation_metadata_required
BEFORE UPDATE OF revoked_at ON sessions
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL AND (
  NEW.revoked_reason IS NULL OR length(trim(NEW.revoked_reason)) < 3
)
BEGIN
  SELECT RAISE(ABORT, 'SESSION_REVOCATION_REASON_REQUIRED');
END;
