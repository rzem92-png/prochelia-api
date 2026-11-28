-- PROCHÉLIA 0023 — tenant/workspace identity foundation (Preview candidate only)
-- Additive schema only. No backfill, no tenant assignment, no route activation.
-- Apply remotely only after a reviewed encrypted backup/restore and human approval.

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('PERSONAL', 'ORGANIZATION')),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 160),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  country_code TEXT CHECK (
    country_code IS NULL OR (
      length(country_code) = 2
      AND country_code = upper(country_code)
      AND country_code GLOB '[A-Z][A-Z]'
    )
  ),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One personal workspace per creator; organizations may have multiple owners.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_personal_creator
  ON tenants(created_by_user_id) WHERE kind = 'PERSONAL';
CREATE INDEX IF NOT EXISTS idx_tenants_status_kind
  ON tenants(status, kind);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'BILLING', 'MEMBER', 'VIEWER')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  invited_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, user_id),
  CHECK (status <> 'ACTIVE' OR accepted_at IS NOT NULL),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_status
  ON tenant_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_status
  ON tenant_memberships(tenant_id, status);

-- Invitations store only a hash of a random token. OWNER invitations are intentionally
-- excluded; ownership transfer requires a separately reviewed, audited workflow.
CREATE TABLE IF NOT EXISTS tenant_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  invitee_email TEXT NOT NULL CHECK (
    length(trim(invitee_email)) BETWEEN 3 AND 254
    AND invitee_email = lower(trim(invitee_email))
  ),
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'BILLING', 'MEMBER', 'VIEWER')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  accepted_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  expired_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status <> 'ACCEPTED' OR (accepted_by_user_id IS NOT NULL AND accepted_at IS NOT NULL)),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL),
  CHECK (status <> 'EXPIRED' OR expired_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_invitations_pending_email
  ON tenant_invitations(tenant_id, invitee_email) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_status_expiry
  ON tenant_invitations(status, expires_at);

CREATE TRIGGER IF NOT EXISTS trg_tenant_invitations_immutable
BEFORE UPDATE OF tenant_id, invitee_email, token_hash, role, invited_by_user_id, expires_at, created_at
ON tenant_invitations
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_TENANT_INVITATION_FIELDS');
END;

CREATE TRIGGER IF NOT EXISTS trg_tenant_invitation_status_transitions
BEFORE UPDATE OF status ON tenant_invitations
WHEN NOT (
  OLD.status = NEW.status OR
  (OLD.status = 'PENDING' AND NEW.status IN ('ACCEPTED', 'REVOKED', 'EXPIRED'))
)
BEGIN
  SELECT RAISE(ABORT, 'INVALID_TENANT_INVITATION_STATUS_TRANSITION');
END;

CREATE TRIGGER IF NOT EXISTS trg_tenant_invitation_expiry_evidence
BEFORE UPDATE OF status ON tenant_invitations
WHEN NEW.status = 'EXPIRED'
  AND (NEW.expired_at IS NULL OR datetime('now') < datetime(OLD.expires_at))
BEGIN
  SELECT RAISE(ABORT, 'TENANT_INVITATION_EXPIRY_EVIDENCE_REQUIRED');
END;

-- Selected workspace is per-session and is not authorization by itself.
-- Runtime code must re-check session/user/membership/tenant state on EVERY request.
CREATE TABLE IF NOT EXISTS tenant_session_context (
  session_id TEXT PRIMARY KEY NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  selected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_session_context_tenant
  ON tenant_session_context(tenant_id);

CREATE TRIGGER IF NOT EXISTS trg_tenant_session_context_membership_insert
BEFORE INSERT ON tenant_session_context
WHEN NOT EXISTS (
  SELECT 1
  FROM sessions s
  JOIN tenant_memberships m ON m.user_id = s.user_id AND m.tenant_id = NEW.tenant_id
  JOIN tenants t ON t.id = m.tenant_id
  WHERE s.id = NEW.session_id AND m.status = 'ACTIVE' AND t.status = 'ACTIVE'
)
BEGIN
  SELECT RAISE(ABORT, 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED');
END;

CREATE TRIGGER IF NOT EXISTS trg_tenant_session_context_membership_update
BEFORE UPDATE OF session_id, tenant_id ON tenant_session_context
WHEN NOT EXISTS (
  SELECT 1
  FROM sessions s
  JOIN tenant_memberships m ON m.user_id = s.user_id AND m.tenant_id = NEW.tenant_id
  JOIN tenants t ON t.id = m.tenant_id
  WHERE s.id = NEW.session_id AND m.status = 'ACTIVE' AND t.status = 'ACTIVE'
)
BEGIN
  SELECT RAISE(ABORT, 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED');
END;

-- Membership suspension/revocation immediately clears the selected workspace
-- for the affected user's sessions. Request authorization must still re-check
-- membership because this table is context, not a substitute for RBAC.
CREATE TRIGGER IF NOT EXISTS trg_tenant_membership_invalidate_context
AFTER UPDATE OF status ON tenant_memberships
WHEN NEW.status <> 'ACTIVE'
BEGIN
  DELETE FROM tenant_session_context
  WHERE tenant_id = NEW.tenant_id
    AND session_id IN (SELECT id FROM sessions WHERE user_id = NEW.user_id);
END;

CREATE TRIGGER IF NOT EXISTS trg_tenant_invalidate_context
AFTER UPDATE OF status ON tenants
WHEN NEW.status <> 'ACTIVE'
BEGIN
  DELETE FROM tenant_session_context WHERE tenant_id = NEW.id;
END;

-- Prevent a workspace from losing its final active owner.
-- Provisioning must create the tenant and initial OWNER membership atomically.
CREATE TRIGGER IF NOT EXISTS trg_tenant_membership_last_owner_update
BEFORE UPDATE OF tenant_id, role, status ON tenant_memberships
WHEN OLD.status = 'ACTIVE' AND OLD.role = 'OWNER'
  AND (NEW.tenant_id <> OLD.tenant_id OR NEW.role <> 'OWNER' OR NEW.status <> 'ACTIVE')
  AND NOT EXISTS (
    SELECT 1 FROM tenant_memberships other
    WHERE other.tenant_id = OLD.tenant_id
      AND other.user_id <> OLD.user_id
      AND other.role = 'OWNER'
      AND other.status = 'ACTIVE'
  )
BEGIN
  SELECT RAISE(ABORT, 'TENANT_LAST_ACTIVE_OWNER_REQUIRED');
END;

CREATE TRIGGER IF NOT EXISTS trg_tenant_membership_last_owner_delete
BEFORE DELETE ON tenant_memberships
WHEN OLD.status = 'ACTIVE' AND OLD.role = 'OWNER'
  AND NOT EXISTS (
    SELECT 1 FROM tenant_memberships other
    WHERE other.tenant_id = OLD.tenant_id
      AND other.user_id <> OLD.user_id
      AND other.role = 'OWNER'
      AND other.status = 'ACTIVE'
  )
BEGIN
  SELECT RAISE(ABORT, 'TENANT_LAST_ACTIVE_OWNER_REQUIRED');
END;

-- Acceptance must bind the invitation to the account whose normalized email matches.
-- The application still validates token possession, expiry and atomic membership creation.
CREATE TRIGGER IF NOT EXISTS trg_tenant_invitation_acceptance_identity
BEFORE UPDATE OF status, accepted_by_user_id ON tenant_invitations
WHEN NEW.status = 'ACCEPTED'
  AND NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = NEW.accepted_by_user_id
      AND lower(trim(u.email)) = NEW.invitee_email
  )
BEGIN
  SELECT RAISE(ABORT, 'TENANT_INVITATION_ACCEPTOR_EMAIL_MISMATCH');
END;

-- Membership identity is immutable: changing tenant/user bypasses invitation
-- and audited ownership-transfer flows. Move access by creating a new accepted
-- membership and revoking the old one through the controlled lifecycle.
CREATE TRIGGER IF NOT EXISTS trg_tenant_membership_identity_immutable
BEFORE UPDATE OF tenant_id, user_id ON tenant_memberships
WHEN NEW.tenant_id <> OLD.tenant_id OR NEW.user_id <> OLD.user_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_MEMBERSHIP_IDENTITY_IMMUTABLE');
END;
