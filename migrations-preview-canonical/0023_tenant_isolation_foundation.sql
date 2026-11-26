-- PROCHÉLIA — tenant isolation foundation (Preview canonical chain only).
-- Additive schema. Legacy rows remain unassigned (tenant_id NULL) and must not
-- be exposed by any tenant-scoped API until explicitly migrated/owned.
CREATE TABLE tenants (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  market_code TEXT NOT NULL DEFAULT 'FR',
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenant_memberships (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('OWNER', 'ADMIN', 'OPS', 'FINANCE', 'SUPPORT', 'CLIENT', 'PROVIDER', 'READ_ONLY')),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  invited_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX idx_tenant_memberships_user_status
  ON tenant_memberships(user_id, status, tenant_id);
CREATE INDEX idx_tenant_memberships_tenant_role_status
  ON tenant_memberships(tenant_id, role, status);

CREATE TABLE tenant_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('OWNER', 'ADMIN', 'OPS', 'FINANCE', 'SUPPORT', 'CLIENT', 'PROVIDER', 'READ_ONLY')),
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  invited_by_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id)
);
CREATE INDEX idx_tenant_invitations_tenant_status_expiry
  ON tenant_invitations(tenant_id, status, expires_at);
CREATE UNIQUE INDEX idx_tenant_invitation_pending_email
  ON tenant_invitations(tenant_id, email_normalized)
  WHERE status = 'PENDING';

-- Scope-bearing columns are nullable solely for legacy compatibility.
-- New tenant-aware APIs must reject NULL and derive tenant_id from auth,
-- never from an untrusted request body.
ALTER TABLE clients ADD COLUMN tenant_id TEXT;
ALTER TABLE intervenants ADD COLUMN tenant_id TEXT;
ALTER TABLE missions ADD COLUMN tenant_id TEXT;
CREATE INDEX idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX idx_intervenants_tenant_id ON intervenants(tenant_id);
CREATE INDEX idx_missions_tenant_id ON missions(tenant_id);
