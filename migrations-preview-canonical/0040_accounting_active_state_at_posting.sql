-- PROCHÉLIA — revalidate accounting entity and account activity at posting time.
-- Additive Preview migration; no remote D1 execution is performed by this change.
CREATE TRIGGER IF NOT EXISTS trg_accounting_entity_active_at_posting
BEFORE UPDATE OF status ON accounting_journals
WHEN OLD.status = 'DRAFT' AND NEW.status = 'POSTED'
  AND NOT EXISTS (
    SELECT 1
    FROM accounting_entities e
    WHERE e.id = NEW.entity_id
      AND e.tenant_id = NEW.tenant_id
      AND e.status = 'ACTIVE'
  )
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNTING_ENTITY_INACTIVE_AT_POSTING');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_accounts_active_at_posting
BEFORE UPDATE OF status ON accounting_journals
WHEN OLD.status = 'DRAFT' AND NEW.status = 'POSTED'
  AND EXISTS (
    SELECT 1
    FROM accounting_journal_lines l
    JOIN accounting_accounts a
      ON a.id = l.account_id
     AND a.tenant_id = l.tenant_id
     AND a.entity_id = l.entity_id
    WHERE l.journal_id = NEW.id
      AND l.tenant_id = NEW.tenant_id
      AND l.entity_id = NEW.entity_id
      AND a.is_active <> 1
  )
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNTING_ACCOUNT_INACTIVE_AT_POSTING');
END;
