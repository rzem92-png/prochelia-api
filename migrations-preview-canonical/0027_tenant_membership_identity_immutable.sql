-- PROCHÉLIA — immutable tenant membership identity.
-- Membership identity changes must be represented by a new invitation, never an UPDATE.
CREATE TRIGGER IF NOT EXISTS trg_tenant_membership_identity_immutable
BEFORE UPDATE OF id, tenant_id, user_id ON tenant_memberships
WHEN NEW.id IS NOT OLD.id
  OR NEW.tenant_id IS NOT OLD.tenant_id
  OR NEW.user_id IS NOT OLD.user_id
BEGIN
  SELECT RAISE(ABORT, 'TENANT_MEMBERSHIP_IDENTITY_IMMUTABLE');
END;
