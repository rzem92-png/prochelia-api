-- PROCHÉLIA — canonical tenant-scoped double-entry accounting ledger.
-- Additive Preview schema only. Posted journals and lines are immutable; corrections use exact reversals.
CREATE TABLE IF NOT EXISTS accounting_entities (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  country_code TEXT NOT NULL CHECK (length(country_code) = 2),
  base_currency TEXT NOT NULL CHECK (length(base_currency) = 3),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_accounting_entities_tenant
  ON accounting_entities(tenant_id, status);

CREATE TABLE IF NOT EXISTS accounting_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (entity_id, account_code),
  UNIQUE (id, tenant_id, entity_id),
  FOREIGN KEY (entity_id, tenant_id) REFERENCES accounting_entities(id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_tenant_entity
  ON accounting_accounts(tenant_id, entity_id, is_active);

CREATE TABLE IF NOT EXISTS accounting_journals (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  journal_code TEXT NOT NULL,
  journal_date TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  posted_by TEXT,
  posted_at TEXT,
  reversal_of_journal_id TEXT,
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (id, tenant_id, entity_id),
  FOREIGN KEY (entity_id, tenant_id) REFERENCES accounting_entities(id, tenant_id),
  FOREIGN KEY (reversal_of_journal_id, tenant_id, entity_id)
    REFERENCES accounting_journals(id, tenant_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_accounting_journals_tenant_date
  ON accounting_journals(tenant_id, entity_id, journal_date, status);
CREATE INDEX IF NOT EXISTS idx_accounting_journals_source
  ON accounting_journals(tenant_id, source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_journals_one_reversal
  ON accounting_journals(reversal_of_journal_id)
  WHERE reversal_of_journal_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  journal_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  side TEXT NOT NULL CHECK (side IN ('DEBIT', 'CREDIT')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (journal_id, line_number),
  FOREIGN KEY (journal_id, tenant_id, entity_id)
    REFERENCES accounting_journals(id, tenant_id, entity_id),
  FOREIGN KEY (account_id, tenant_id, entity_id)
    REFERENCES accounting_accounts(id, tenant_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_accounting_lines_journal
  ON accounting_journal_lines(tenant_id, journal_id, line_number);
CREATE INDEX IF NOT EXISTS idx_accounting_lines_account
  ON accounting_journal_lines(tenant_id, entity_id, account_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_accounting_line_draft_only
BEFORE INSERT ON accounting_journal_lines
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounting_journals j
    WHERE j.id = NEW.journal_id AND j.tenant_id = NEW.tenant_id
      AND j.entity_id = NEW.entity_id AND j.status = 'DRAFT'
      AND j.currency = NEW.currency
  ) THEN RAISE(ABORT, 'ACCOUNTING_JOURNAL_NOT_DRAFT_OR_SCOPE_MISMATCH') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM accounting_accounts a
    WHERE a.id = NEW.account_id AND a.tenant_id = NEW.tenant_id
      AND a.entity_id = NEW.entity_id AND a.is_active = 1
  ) THEN RAISE(ABORT, 'ACCOUNTING_ACCOUNT_INACTIVE_OR_SCOPE_MISMATCH') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_lines_no_update_posted
BEFORE UPDATE ON accounting_journal_lines
WHEN EXISTS (SELECT 1 FROM accounting_journals WHERE id = OLD.journal_id AND status = 'POSTED')
BEGIN
  SELECT RAISE(ABORT, 'POSTED_ACCOUNTING_LINES_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_accounting_lines_no_delete_posted
BEFORE DELETE ON accounting_journal_lines
WHEN EXISTS (SELECT 1 FROM accounting_journals WHERE id = OLD.journal_id AND status = 'POSTED')
BEGIN
  SELECT RAISE(ABORT, 'POSTED_ACCOUNTING_LINES_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_journal_post_guard
BEFORE UPDATE OF status ON accounting_journals
WHEN OLD.status = 'DRAFT' AND NEW.status = 'POSTED'
BEGIN
  SELECT CASE WHEN NEW.posted_by IS NULL OR length(trim(NEW.posted_by)) = 0 OR NEW.posted_at IS NULL
    THEN RAISE(ABORT, 'ACCOUNTING_POSTING_ACTOR_AND_TIMESTAMP_REQUIRED') END;
  SELECT CASE WHEN (SELECT COUNT(*) FROM accounting_journal_lines WHERE journal_id = NEW.id) < 2
    THEN RAISE(ABORT, 'ACCOUNTING_JOURNAL_REQUIRES_AT_LEAST_TWO_LINES') END;
  SELECT CASE WHEN
    (SELECT COALESCE(SUM(amount_cents), 0) FROM accounting_journal_lines WHERE journal_id = NEW.id AND side = 'DEBIT')
    !=
    (SELECT COALESCE(SUM(amount_cents), 0) FROM accounting_journal_lines WHERE journal_id = NEW.id AND side = 'CREDIT')
    THEN RAISE(ABORT, 'ACCOUNTING_JOURNAL_NOT_BALANCED') END;
  SELECT CASE WHEN NEW.reversal_of_journal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM accounting_journals original
    WHERE original.id = NEW.reversal_of_journal_id
      AND original.tenant_id = NEW.tenant_id AND original.entity_id = NEW.entity_id
      AND original.currency = NEW.currency AND original.status = 'POSTED'
      AND (SELECT COUNT(*) FROM accounting_journal_lines WHERE journal_id = original.id)
          = (SELECT COUNT(*) FROM accounting_journal_lines WHERE journal_id = NEW.id)
      AND NOT EXISTS (
        SELECT 1 FROM accounting_journal_lines old_line
        WHERE old_line.journal_id = original.id AND NOT EXISTS (
          SELECT 1 FROM accounting_journal_lines new_line
          WHERE new_line.journal_id = NEW.id
            AND new_line.account_id = old_line.account_id
            AND new_line.amount_cents = old_line.amount_cents
            AND new_line.currency = old_line.currency
            AND new_line.side = CASE old_line.side WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END
        )
      )
  ) THEN RAISE(ABORT, 'ACCOUNTING_REVERSAL_MUST_EXACTLY_MIRROR_POSTED_JOURNAL') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_accounting_posted_journal_immutable
BEFORE UPDATE ON accounting_journals
WHEN OLD.status = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'POSTED_ACCOUNTING_JOURNAL_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_accounting_posted_journal_no_delete
BEFORE DELETE ON accounting_journals
WHEN OLD.status = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'POSTED_ACCOUNTING_JOURNAL_IMMUTABLE');
END;
