-- PROCHÉLIA — enforce currency consistency for draft and posted accounting journals.
-- Additive hardening: existing journals are not rewritten; incoherent draft journals cannot be posted.
CREATE TRIGGER IF NOT EXISTS trg_accounting_journal_currency_immutable_with_lines
BEFORE UPDATE OF currency ON accounting_journals
WHEN NEW.currency <> OLD.currency
  AND EXISTS (
    SELECT 1 FROM accounting_journal_lines
    WHERE journal_id = OLD.id AND tenant_id = OLD.tenant_id AND entity_id = OLD.entity_id
  )
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNTING_JOURNAL_CURRENCY_IMMUTABLE_WITH_LINES');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_journal_post_currency_match
BEFORE UPDATE OF status ON accounting_journals
WHEN OLD.status = 'DRAFT' AND NEW.status = 'POSTED'
  AND EXISTS (
    SELECT 1 FROM accounting_journal_lines
    WHERE journal_id = NEW.id
      AND (tenant_id <> NEW.tenant_id OR entity_id <> NEW.entity_id OR currency <> NEW.currency)
  )
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNTING_JOURNAL_LINE_CURRENCY_MISMATCH');
END;
