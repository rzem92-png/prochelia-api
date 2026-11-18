-- PROCHÉLIA — authoritative tenant and membership registry.
-- Additive schema foundation. Runtime authorization must still resolve membership server-side.
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK (length(trim(slug)) BETWEEN 3 AND 80),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 2 AND 200),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'FINANCE', 'OPERATOR', 'SUPPORT', 'MEMBER', 'READ_ONLY')),
  status TEXT NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  invited_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT,
  revoked_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, user_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id),
  CHECK (
    (status = 'INVITED' AND accepted_at IS NULL AND revoked_at IS NULL) OR
    (status = 'ACTIVE' AND accepted_at IS NOT NULL AND revoked_at IS NULL) OR
    (status = 'SUSPENDED' AND accepted_at IS NOT NULL AND revoked_at IS NULL) OR
    (status = 'REVOKED' AND revoked_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_status
  ON tenant_memberships(user_id, status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_role_status
  ON tenant_memberships(tenant_id, role, status);

CREATE TABLE IF NOT EXISTS tenant_membership_events (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  actor_user_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'INVITED', 'ACCEPTED', 'ROLE_CHANGED', 'SUSPENDED', 'REACTIVATED', 'REVOKED'
  )),
  previous_role TEXT,
  new_role TEXT,
  previous_status TEXT,
  new_status TEXT,
  reason_code TEXT NOT NULL CHECK (length(trim(reason_code)) BETWEEN 2 AND 80),
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (membership_id, tenant_id) REFERENCES tenant_memberships(id, tenant_id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_membership_events_tenant_time
  ON tenant_membership_events(tenant_id, occurred_at, id);

-- Tenant membership history is append-only; correction requires a compensating event.
CREATE TRIGGER IF NOT EXISTS trg_tenant_membership_events_no_update
BEFORE UPDATE ON tenant_membership_events
BEGIN
  SELECT RAISE(ABORT, 'TENANT_MEMBERSHIP_EVENTS_APPEND_ONLY');
END;
CREATE TRIGGER IF NOT EXISTS trg_tenant_membership_events_no_delete
BEFORE DELETE ON tenant_membership_events
BEGIN
  SELECT RAISE(ABORT, 'TENANT_MEMBERSHIP_EVENTS_APPEND_ONLY');
END;

-- A revoked membership is terminal. Re-invitation must use a new membership ID
-- after an explicit administrative workflow rather than silently reviving history.
CREATE TRIGGER IF NOT EXISTS trg_tenant_membership_revocation_terminal
BEFORE UPDATE ON tenant_memberships
WHEN OLD.status = 'REVOKED'
BEGIN
  SELECT RAISE(ABORT, 'TENANT_MEMBERSHIP_REVOKED_TERMINAL');
END;

CREATE TRIGGER IF NOT EXISTS trg_tenant_membership_event_tenant_match
BEFORE INSERT ON tenant_membership_events
WHEN NOT EXISTS (
  SELECT 1 FROM tenant_memberships m
  WHERE m.id = NEW.membership_id AND m.tenant_id = NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'TENANT_MEMBERSHIP_EVENT_SCOPE_MISMATCH');
END;

-- Accounting entities cannot be attached to unknown or inactive tenants.
CREATE TRIGGER IF NOT EXISTS trg_accounting_entity_requires_active_tenant
BEFORE INSERT ON accounting_entities
WHEN NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = NEW.tenant_id AND t.status = 'ACTIVE')
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNTING_ENTITY_TENANT_NOT_ACTIVE');
END;
CREATE TRIGGER IF NOT EXISTS trg_accounting_entity_tenant_stable
BEFORE UPDATE OF tenant_id ON accounting_entities
WHEN NEW.tenant_id <> OLD.tenant_id
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNTING_ENTITY_TENANT_IMMUTABLE');
END;
