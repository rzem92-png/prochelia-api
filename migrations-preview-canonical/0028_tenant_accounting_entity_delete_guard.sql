-- PROCHÉLIA — protect accounting tenant references from orphaning.
-- accounting_entities predates the tenants table in the canonical migration order,
-- so a real FK cannot be added without rebuilding the ledger tables. Enforce the
-- same referential invariant at the database boundary for tenant deletion.
CREATE TRIGGER IF NOT EXISTS trg_tenant_no_delete_with_accounting_entities
BEFORE DELETE ON tenants
WHEN EXISTS (
  SELECT 1 FROM accounting_entities e WHERE e.tenant_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'TENANT_HAS_ACCOUNTING_ENTITIES');
END;
