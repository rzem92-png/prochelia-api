-- PROCHÉLIA — secure, tenant-scoped invitation foundation for intervenant onboarding.
-- Stores only a SHA-256 token digest; raw invitation secrets must be delivered by a configured
-- out-of-band mail adapter and must never be returned by public API responses or logged.
-- This migration deliberately does not create public signup routes or activate memberships.

CREATE TABLE IF NOT EXISTS tenant_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL CHECK (
    length(email_normalized) BETWEEN 6 AND 254
    AND email_normalized = lower(trim(email_normalized))
    AND instr(email_normalized, '@') > 1
  ),
  intended_role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (intended_role = 'MEMBER'),
  token_sha256 TEXT NOT NULL UNIQUE CHECK (length(token_sha256) = 64),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED')),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 128),
  invited_by_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (membership_id, tenant_id) REFERENCES tenant_memberships(id, tenant_id),
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id),
  CHECK (
    (status = 'PENDING' AND accepted_at IS NULL AND revoked_at IS NULL) OR
    (status = 'ACCEPTED' AND accepted_at IS NOT NULL AND revoked_at IS NULL) OR
    (status = 'REVOKED' AND accepted_at IS NULL AND revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_invitations_one_pending_email
  ON tenant_invitations(tenant_id, email_normalized)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_expiry
  ON tenant_invitations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_membership
  ON tenant_invitations(tenant_id, membership_id);

CREATE TABLE IF NOT EXISTS tenant_invitation_events (
  id TEXT PRIMARY KEY NOT NULL,
  invitation_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  actor_user_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATED', 'RESENT', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  reason_code TEXT NOT NULL CHECK (length(trim(reason_code)) BETWEEN 2 AND 80),
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id, tenant_id) REFERENCES tenant_invitations(id, tenant_id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_invitation_events_tenant_time
  ON tenant_invitation_events(tenant_id, occurred_at, id);

CREATE TRIGGER IF NOT EXISTS trg_tenant_invitation_requires_pending_member
BEFORE INSERT ON tenant_invitations
WHEN NOT EXISTS (
  SELECT 1
  FROM tenants t
  JOIN tenant_memberships m ON m.tenant_id = t.id
  WHERE t.id = NEW.tenant_id
    AND t.status = 'ACTIVE'
    AND m.id = NEW.membership_id
    AND m.tenant_id = NEW.tenant_id
    AND m.role = 'MEMBER'
    AND m.status = 'INVITED'
)
BEGIN
  SELECT RAISE(ABORT, 'TENANT_INVITATION_REQUIRES_ACTIVE_TENANT_PENDING_MEMBER');
END;

CREATE TRIGGER IF NOT EXISTS trg_tenant_invitation_initial_pending
BEFORE INSERT ON tenant_invitations
WHEN NEW.status <> 'PENDING' OR NEW.accepted_at IS NOT NULL OR NEW.revoked_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'TENANT_INVITATION_MUST_START_PENDING');
END;

CREATE TRIGGER IF NOT EXISTS trg_tenant_invitation_identity_immutable
BEFORE UPDATE OF id, tenant_id, membership_id, email_normalized, intended_role,
                 token_sha256, idempotency_key, invited_by_user_id, expires_at
ON tenant_invitations
BEGIN
  SELECT RAISE(ABORT, 'TENANT_INVITATION_IDENTITY_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_tenant_invitation_terminal
BEFORE UPDATE ON tenant_invitations
WHEN OLD.status IN ('ACCEPTED', 'REVOKED')
BEGIN
  SELECT RAISE(ABORT, 'TENANT_INVITATION_TERMINAL');
END;

CREATE TRIGGER IF NOT EXISTS trg_tenant_invitation_events_no_update
BEFORE UPDATE ON tenant_invitation_events
BEGIN
  SELECT RAISE(ABORT, 'TENANT_INVITATION_EVENTS_APPEND_ONLY');
END;
CREATE TRIGGER IF NOT EXISTS trg_tenant_invitation_events_no_delete
BEFORE DELETE ON tenant_invitation_events
BEGIN
  SELECT RAISE(ABORT, 'TENANT_INVITATION_EVENTS_APPEND_ONLY');
END;
