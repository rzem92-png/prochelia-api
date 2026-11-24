-- PROCHÉLIA — tenant boundary for the payment runtime.
-- Additive only: legacy financial rows remain NULL until individually attributed
-- CI runs the full canonical Preview migration chain and synthetic multi-tenant financial isolation fixtures.
-- from auditable source records. New financial writes must carry an active tenant.
-- Webhook inbox events remain globally keyed by provider/event ID; tenant binding
-- is attached only after the signed event is matched to an internal transaction.

CREATE TABLE IF NOT EXISTS payment_accounts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL,
  provider_account_id TEXT, status TEXT NOT NULL DEFAULT 'pending',
  onboarding_status TEXT NOT NULL DEFAULT 'required',
  payouts_enabled INTEGER NOT NULL DEFAULT 0, charges_enabled INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, mission_id TEXT,
  client_id TEXT, intervenant_id TEXT, type TEXT NOT NULL, status TEXT NOT NULL,
  gross_cents INTEGER NOT NULL DEFAULT 0, commission_cents INTEGER NOT NULL DEFAULT 0,
  provider_fee_cents INTEGER NOT NULL DEFAULT 0, refund_cents INTEGER NOT NULL DEFAULT 0,
  net_intervenant_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'EUR',
  provider TEXT, provider_payment_id TEXT, provider_payout_id TEXT, reason TEXT, metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payout_requests (
  id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, wallet_id TEXT NOT NULL,
  user_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR',
  mode TEXT NOT NULL DEFAULT 'standard', status TEXT NOT NULL DEFAULT 'requested',
  provider TEXT, provider_payout_id TEXT, failure_code TEXT, failure_message TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payment_disputes (
  id TEXT PRIMARY KEY, mission_id TEXT, transaction_id TEXT, client_id TEXT, intervenant_id TEXT,
  status TEXT NOT NULL DEFAULT 'open', reason TEXT, amount_cents INTEGER NOT NULL DEFAULT 0,
  resolution TEXT, resolved_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY, provider TEXT NOT NULL, event_id TEXT NOT NULL, event_type TEXT NOT NULL,
  signature_valid INTEGER NOT NULL DEFAULT 0, processed INTEGER NOT NULL DEFAULT 0,
  payload_hash TEXT, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, processed_at TEXT,
  UNIQUE(provider,event_id)
);
CREATE TABLE IF NOT EXISTS payment_reconciliation (
  id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_id TEXT NOT NULL,
  internal_transaction_id TEXT, internal_payout_id TEXT, amount_cents INTEGER, currency TEXT,
  status TEXT NOT NULL DEFAULT 'unmatched', checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider,external_id)
);
CREATE TABLE IF NOT EXISTS payment_audit (
  id TEXT PRIMARY KEY, event_type TEXT NOT NULL, transaction_id TEXT, payout_id TEXT,
  mission_id TEXT, user_id TEXT, result TEXT NOT NULL, metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE payment_accounts ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE payment_transactions ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE payout_requests ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE payment_disputes ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE payment_wallet_ledger ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE payment_reconciliation ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE payment_audit ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE payment_webhook_events ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_accounts_tenant_user ON payment_accounts(tenant_id,user_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_tenant_mission_created ON payment_transactions(tenant_id,mission_id,created_at);
CREATE INDEX IF NOT EXISTS idx_payment_tx_tenant_intervenant_status ON payment_transactions(tenant_id,intervenant_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_payout_tenant_user_status ON payout_requests(tenant_id,user_id,status,requested_at);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_tenant_mission ON payment_disputes(tenant_id,mission_id,created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_tenant_user_date ON payment_wallet_ledger(tenant_id,user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_tenant_status ON payment_reconciliation(tenant_id,status,checked_at);
CREATE INDEX IF NOT EXISTS idx_payment_audit_tenant_created ON payment_audit(tenant_id,created_at);

CREATE TRIGGER IF NOT EXISTS trg_payment_account_tenant_insert
BEFORE INSERT ON payment_accounts
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN tenant_memberships m ON m.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND m.user_id=NEW.user_id AND m.status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_ACCOUNT_ACTIVE_TENANT_MEMBERSHIP_REQUIRED'); END;
CREATE TRIGGER IF NOT EXISTS trg_payment_account_tenant_update
BEFORE UPDATE OF tenant_id,user_id ON payment_accounts
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN tenant_memberships m ON m.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND m.user_id=NEW.user_id AND m.status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_ACCOUNT_ACTIVE_TENANT_MEMBERSHIP_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_transaction_tenant_insert
BEFORE INSERT ON payment_transactions
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN missions m ON m.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND m.id=NEW.mission_id AND m.client_id=NEW.client_id
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_TRANSACTION_MISSION_TENANT_MISMATCH'); END;
CREATE TRIGGER IF NOT EXISTS trg_payment_transaction_tenant_update
BEFORE UPDATE OF tenant_id,mission_id,client_id ON payment_transactions
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN missions m ON m.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND m.id=NEW.mission_id AND m.client_id=NEW.client_id
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_TRANSACTION_MISSION_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_payout_request_tenant_insert
BEFORE INSERT ON payout_requests
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN wallets w ON w.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND w.id=NEW.wallet_id AND w.user_id=NEW.user_id
)
BEGIN SELECT RAISE(ABORT,'PAYOUT_REQUEST_WALLET_TENANT_MISMATCH'); END;
CREATE TRIGGER IF NOT EXISTS trg_payout_request_tenant_update
BEFORE UPDATE OF tenant_id,wallet_id,user_id ON payout_requests
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN wallets w ON w.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND w.id=NEW.wallet_id AND w.user_id=NEW.user_id
)
BEGIN SELECT RAISE(ABORT,'PAYOUT_REQUEST_WALLET_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_dispute_tenant_insert
BEFORE INSERT ON payment_disputes
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM payment_transactions tx
  WHERE tx.id=NEW.transaction_id AND tx.tenant_id=NEW.tenant_id
    AND tx.mission_id=NEW.mission_id
    AND tx.client_id IS NEW.client_id
    AND tx.intervenant_id IS NEW.intervenant_id
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_DISPUTE_TRANSACTION_TENANT_MISMATCH'); END;
CREATE TRIGGER IF NOT EXISTS trg_payment_dispute_tenant_update
BEFORE UPDATE OF tenant_id,transaction_id,mission_id ON payment_disputes
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM payment_transactions tx
  WHERE tx.id=NEW.transaction_id AND tx.tenant_id=NEW.tenant_id
    AND tx.mission_id=NEW.mission_id
    AND tx.client_id IS NEW.client_id
    AND tx.intervenant_id IS NEW.intervenant_id
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_DISPUTE_TRANSACTION_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_wallet_ledger_tenant_insert
BEFORE INSERT ON payment_wallet_ledger
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM wallets w
  WHERE w.tenant_id=NEW.tenant_id AND w.user_id=NEW.user_id AND w.currency=NEW.currency
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_WALLET_LEDGER_TENANT_MISMATCH'); END;
CREATE TRIGGER IF NOT EXISTS trg_wallet_ledger_tenant_update
BEFORE UPDATE OF tenant_id,user_id,currency ON payment_wallet_ledger
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM wallets w
  WHERE w.tenant_id=NEW.tenant_id AND w.user_id=NEW.user_id AND w.currency=NEW.currency
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_WALLET_LEDGER_TENANT_MISMATCH'); END;

-- Legacy ledger rows may be attributed once after an audited wallet match.
-- All economic fields remain immutable; after tenant attribution, every UPDATE is rejected.
DROP TRIGGER IF EXISTS trg_payment_wallet_ledger_no_update;
CREATE TRIGGER trg_payment_wallet_ledger_no_update
BEFORE UPDATE ON payment_wallet_ledger
WHEN OLD.tenant_id IS NOT NULL
  OR NEW.id IS NOT OLD.id
  OR NEW.idempotency_key IS NOT OLD.idempotency_key
  OR NEW.transaction_id IS NOT OLD.transaction_id
  OR NEW.payout_id IS NOT OLD.payout_id
  OR NEW.user_id IS NOT OLD.user_id
  OR NEW.entry_type IS NOT OLD.entry_type
  OR NEW.available_delta_cents IS NOT OLD.available_delta_cents
  OR NEW.pending_delta_cents IS NOT OLD.pending_delta_cents
  OR NEW.reserved_delta_cents IS NOT OLD.reserved_delta_cents
  OR NEW.paid_delta_cents IS NOT OLD.paid_delta_cents
  OR NEW.currency IS NOT OLD.currency
  OR NEW.metadata_json IS NOT OLD.metadata_json
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.tenant_id IS NULL
BEGIN SELECT RAISE(ABORT,'PAYMENT_WALLET_LEDGER_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_reconciliation_tenant_insert
BEFORE INSERT ON payment_reconciliation
WHEN NEW.tenant_id IS NULL OR (
  NEW.internal_transaction_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM payment_transactions tx WHERE tx.id=NEW.internal_transaction_id AND tx.tenant_id=NEW.tenant_id
  )
) OR (
  NEW.internal_payout_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM payout_requests p WHERE p.id=NEW.internal_payout_id AND p.tenant_id=NEW.tenant_id
  )
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_RECONCILIATION_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_reconciliation_tenant_update
BEFORE UPDATE OF tenant_id ON payment_reconciliation
WHEN NEW.tenant_id IS NULL OR (
  NEW.internal_transaction_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM payment_transactions tx WHERE tx.id=NEW.internal_transaction_id AND tx.tenant_id=NEW.tenant_id
  )
) OR (
  NEW.internal_payout_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM payout_requests p WHERE p.id=NEW.internal_payout_id AND p.tenant_id=NEW.tenant_id
  )
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_RECONCILIATION_TENANT_MISMATCH'); END;

-- Ledger balance application is now constrained to the matching tenant wallet.
DROP TRIGGER IF EXISTS trg_payment_wallet_ledger_apply;
CREATE TRIGGER trg_payment_wallet_ledger_apply
AFTER INSERT ON payment_wallet_ledger
BEGIN
  UPDATE wallets SET
    available_cents=available_cents+NEW.available_delta_cents,
    pending_cents=pending_cents+NEW.pending_delta_cents,
    reserved_cents=reserved_cents+NEW.reserved_delta_cents,
    paid_cents=paid_cents+NEW.paid_delta_cents,
    updated_at=CURRENT_TIMESTAMP
  WHERE user_id=NEW.user_id AND tenant_id=NEW.tenant_id;
END;

-- Tenant and financial identity may be attributed once from NULL, but never moved
-- to another tenant after attribution. Mutable status fields remain available.
CREATE TRIGGER IF NOT EXISTS trg_payment_account_tenant_immutable
BEFORE UPDATE OF tenant_id,user_id,provider ON payment_accounts
WHEN (OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS NOT OLD.tenant_id)
  OR NEW.user_id IS NOT OLD.user_id
  OR NEW.provider IS NOT OLD.provider
BEGIN SELECT RAISE(ABORT,'PAYMENT_ACCOUNT_TENANT_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_transaction_identity_immutable
BEFORE UPDATE OF tenant_id,mission_id,client_id,intervenant_id ON payment_transactions
WHEN (OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS NOT OLD.tenant_id)
  OR NEW.mission_id IS NOT OLD.mission_id
  OR NEW.client_id IS NOT OLD.client_id
  OR NEW.intervenant_id IS NOT OLD.intervenant_id
BEGIN SELECT RAISE(ABORT,'PAYMENT_TRANSACTION_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_payout_request_identity_immutable
BEFORE UPDATE OF tenant_id,wallet_id,user_id,idempotency_key,amount_cents ON payout_requests
WHEN (OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS NOT OLD.tenant_id)
  OR NEW.wallet_id IS NOT OLD.wallet_id OR NEW.user_id IS NOT OLD.user_id
  OR NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.amount_cents IS NOT OLD.amount_cents
BEGIN SELECT RAISE(ABORT,'PAYOUT_REQUEST_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_dispute_identity_immutable
BEFORE UPDATE OF tenant_id,transaction_id,mission_id,client_id,intervenant_id ON payment_disputes
WHEN (OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS NOT OLD.tenant_id)
  OR NEW.transaction_id IS NOT OLD.transaction_id
  OR NEW.mission_id IS NOT OLD.mission_id
  OR NEW.client_id IS NOT OLD.client_id
  OR NEW.intervenant_id IS NOT OLD.intervenant_id
BEGIN SELECT RAISE(ABORT,'PAYMENT_DISPUTE_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_reconciliation_identity_immutable
BEFORE UPDATE OF tenant_id,provider,external_id,internal_transaction_id,internal_payout_id ON payment_reconciliation
WHEN (OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS NOT OLD.tenant_id)
  OR NEW.provider IS NOT OLD.provider OR NEW.external_id IS NOT OLD.external_id
  OR NEW.internal_transaction_id IS NOT OLD.internal_transaction_id
  OR NEW.internal_payout_id IS NOT OLD.internal_payout_id
BEGIN SELECT RAISE(ABORT,'PAYMENT_RECONCILIATION_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_webhook_tenant_immutable
BEFORE UPDATE OF tenant_id ON payment_webhook_events
WHEN OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS NOT OLD.tenant_id
BEGIN SELECT RAISE(ABORT,'PAYMENT_WEBHOOK_TENANT_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_webhook_identity_immutable
BEFORE UPDATE OF provider,event_id,event_type ON payment_webhook_events
WHEN NEW.provider IS NOT OLD.provider
  OR NEW.event_id IS NOT OLD.event_id
  OR NEW.event_type IS NOT OLD.event_type
BEGIN SELECT RAISE(ABORT,'PAYMENT_WEBHOOK_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_audit_no_update
BEFORE UPDATE ON payment_audit
BEGIN SELECT RAISE(ABORT,'PAYMENT_AUDIT_APPEND_ONLY'); END;
CREATE TRIGGER IF NOT EXISTS trg_payment_audit_no_delete
BEFORE DELETE ON payment_audit
BEGIN SELECT RAISE(ABORT,'PAYMENT_AUDIT_APPEND_ONLY'); END;
