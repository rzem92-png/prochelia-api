-- PROCHÉLIA — enforce live accounting entity/account state at journal posting.
-- Additive canonical Preview migration; no remote D1 application is performed here.
CREATE TRIGGER IF NOT EXISTS trg_accounting_journal_post_active_scope
BEFORE UPDATE OF status ON accounting_journals
WHEN OLD.status = 'DRAFT' AND NEW.status = 'POSTED'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM accounting_entities e
    WHERE e.id = NEW.entity_id
      AND e.tenant_id = NEW.tenant_id
      AND e.status = 'ACTIVE'
  ) THEN RAISE(ABORT, 'ACCOUNTING_ENTITY_INACTIVE_AT_POSTING') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM accounting_journal_lines l
    LEFT JOIN accounting_accounts a
      ON a.id = l.account_id
     AND a.tenant_id = l.tenant_id
     AND a.entity_id = l.entity_id
    WHERE l.journal_id = NEW.id
      AND l.tenant_id = NEW.tenant_id
      AND l.entity_id = NEW.entity_id
      AND (a.id IS NULL OR a.is_active <> 1)
  ) THEN RAISE(ABORT, 'ACCOUNTING_ACCOUNT_INACTIVE_AT_POSTING') END;
END;
