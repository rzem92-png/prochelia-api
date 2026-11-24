-- PROCHÉLIA — tenant- and currency-scoped wallet identity and ledger application.
-- Rebuild only the Preview wallet table. Preserve every legacy balance and NULL tenant attribution.
-- New wallet rows remain gated by the active-tenant and membership triggers below.

-- Drop every dependent trigger before replacing wallets; SQLite validates
-- trigger bodies during DROP TABLE and otherwise rejects the rebuild.
DROP TRIGGER IF EXISTS trg_payment_wallet_ledger_require_wallet;
DROP TRIGGER IF EXISTS trg_payment_wallet_ledger_guard_balances;
DROP TRIGGER IF EXISTS trg_payment_wallet_ledger_apply;
DROP TRIGGER IF EXISTS trg_wallet_ledger_tenant_insert;
DROP TRIGGER IF EXISTS trg_wallet_ledger_tenant_update;
DROP TRIGGER IF EXISTS trg_payout_request_tenant_insert;
DROP TRIGGER IF EXISTS trg_payout_request_tenant_update;

CREATE TABLE wallets_tenant_scoped (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  available_cents INTEGER NOT NULL DEFAULT 0,
  pending_cents INTEGER NOT NULL DEFAULT 0,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  reserved_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT REFERENCES tenants(id)
);

INSERT INTO wallets_tenant_scoped (
  id,user_id,currency,available_cents,pending_cents,paid_cents,reserved_cents,
  created_at,updated_at,tenant_id
)
SELECT
  id,user_id,currency,available_cents,pending_cents,paid_cents,reserved_cents,
  created_at,updated_at,tenant_id
FROM wallets;

DROP TABLE wallets;
ALTER TABLE wallets_tenant_scoped RENAME TO wallets;

-- A user can hold a distinct wallet per tenant and currency. Legacy NULL-tenant
-- rows remain unassigned and are excluded from tenant-visible queries.
CREATE UNIQUE INDEX idx_wallets_tenant_user_currency
  ON wallets(tenant_id,user_id,currency);
CREATE INDEX idx_wallets_tenant_user
  ON wallets(tenant_id,user_id);

CREATE TRIGGER trg_wallets_require_active_tenant
BEFORE INSERT ON wallets
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT,'WALLET_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER trg_wallets_membership_scope
BEFORE INSERT ON wallets
WHEN NOT EXISTS (
  SELECT 1 FROM tenant_memberships m
  WHERE m.user_id=NEW.user_id AND m.tenant_id=NEW.tenant_id AND m.status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT,'WALLET_TENANT_MEMBERSHIP_REQUIRED'); END;

CREATE TRIGGER trg_wallets_tenant_immutable
BEFORE UPDATE OF tenant_id ON wallets
WHEN OLD.tenant_id IS NOT NULL AND NEW.tenant_id <> OLD.tenant_id
BEGIN SELECT RAISE(ABORT,'WALLETS_TENANT_IMMUTABLE'); END;

CREATE TRIGGER trg_wallets_membership_scope_update
BEFORE UPDATE OF tenant_id,user_id ON wallets
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenant_memberships m
  WHERE m.user_id=NEW.user_id AND m.tenant_id=NEW.tenant_id AND m.status='ACTIVE'
)
BEGIN SELECT RAISE(ABORT,'WALLET_TENANT_MEMBERSHIP_REQUIRED'); END;

CREATE TRIGGER trg_wallets_user_identity_immutable
BEFORE UPDATE OF user_id ON wallets
WHEN NEW.user_id IS NOT OLD.user_id
BEGIN SELECT RAISE(ABORT,'WALLETS_USER_IDENTITY_IMMUTABLE'); END;

-- Restore the tenant guards that were temporarily dropped for the table rebuild.
CREATE TRIGGER trg_wallet_ledger_tenant_insert
BEFORE INSERT ON payment_wallet_ledger
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM wallets w
  WHERE w.tenant_id=NEW.tenant_id
    AND w.user_id=NEW.user_id
    AND w.currency=NEW.currency
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_WALLET_LEDGER_TENANT_MISMATCH'); END;

CREATE TRIGGER trg_wallet_ledger_tenant_update
BEFORE UPDATE OF tenant_id,user_id,currency ON payment_wallet_ledger
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM wallets w
  WHERE w.tenant_id=NEW.tenant_id
    AND w.user_id=NEW.user_id
    AND w.currency=NEW.currency
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_WALLET_LEDGER_TENANT_MISMATCH'); END;

-- The old 0004 triggers selected wallets by user_id only. That becomes ambiguous
-- once a user has multiple tenant wallets or multiple currencies.
DROP TRIGGER IF EXISTS trg_payment_wallet_ledger_require_wallet;
CREATE TRIGGER trg_payment_wallet_ledger_require_wallet
BEFORE INSERT ON payment_wallet_ledger
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM wallets w
  WHERE w.tenant_id=NEW.tenant_id
    AND w.user_id=NEW.user_id
    AND w.currency=NEW.currency
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_WALLET_NOT_FOUND_OR_SCOPE_MISMATCH'); END;

DROP TRIGGER IF EXISTS trg_payment_wallet_ledger_guard_balances;
CREATE TRIGGER trg_payment_wallet_ledger_guard_balances
BEFORE INSERT ON payment_wallet_ledger
BEGIN
  SELECT CASE WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM wallets w
    WHERE w.tenant_id=NEW.tenant_id
      AND w.user_id=NEW.user_id
      AND w.currency=NEW.currency
  ) THEN RAISE(ABORT,'PAYMENT_WALLET_NOT_FOUND_OR_SCOPE_MISMATCH') END;

  SELECT CASE
    WHEN typeof((
      SELECT available_cents FROM wallets
      WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND currency=NEW.currency
    ) + NEW.available_delta_cents) <> 'integer'
      OR typeof((
      SELECT pending_cents FROM wallets
      WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND currency=NEW.currency
    ) + NEW.pending_delta_cents) <> 'integer'
      OR typeof((
      SELECT reserved_cents FROM wallets
      WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND currency=NEW.currency
    ) + NEW.reserved_delta_cents) <> 'integer'
      OR typeof((
      SELECT paid_cents FROM wallets
      WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND currency=NEW.currency
    ) + NEW.paid_delta_cents) <> 'integer'
    THEN RAISE(ABORT,'PAYMENT_WALLET_INTEGER_OVERFLOW')
  END;

  SELECT CASE
    WHEN (
      SELECT pending_cents FROM wallets
      WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND currency=NEW.currency
    ) + NEW.pending_delta_cents < 0
      OR (
      SELECT reserved_cents FROM wallets
      WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND currency=NEW.currency
    ) + NEW.reserved_delta_cents < 0
      OR (
      SELECT paid_cents FROM wallets
      WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND currency=NEW.currency
    ) + NEW.paid_delta_cents < 0
    THEN RAISE(ABORT,'PAYMENT_WALLET_NEGATIVE_PROTECTED_BALANCE')
  END;
END;

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
  WHERE tenant_id=NEW.tenant_id
    AND user_id=NEW.user_id
    AND currency=NEW.currency;
END;

-- A payout must use the exact tenant wallet and its currency.
DROP TRIGGER IF EXISTS trg_payout_request_tenant_insert;
CREATE TRIGGER trg_payout_request_tenant_insert
BEFORE INSERT ON payout_requests
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN wallets w ON w.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND w.id=NEW.wallet_id AND w.user_id=NEW.user_id AND w.currency=NEW.currency
)
BEGIN SELECT RAISE(ABORT,'PAYOUT_REQUEST_WALLET_TENANT_MISMATCH'); END;

DROP TRIGGER IF EXISTS trg_payout_request_tenant_update;
CREATE TRIGGER trg_payout_request_tenant_update
BEFORE UPDATE OF tenant_id,wallet_id,user_id,currency ON payout_requests
WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants t JOIN wallets w ON w.tenant_id=t.id
  WHERE t.id=NEW.tenant_id AND t.status='ACTIVE'
    AND w.id=NEW.wallet_id AND w.user_id=NEW.user_id AND w.currency=NEW.currency
)
BEGIN SELECT RAISE(ABORT,'PAYOUT_REQUEST_WALLET_TENANT_MISMATCH'); END;

DROP TRIGGER IF EXISTS trg_payout_request_identity_immutable;
CREATE TRIGGER trg_payout_request_identity_immutable
BEFORE UPDATE OF tenant_id,wallet_id,user_id,idempotency_key,amount_cents,currency ON payout_requests
WHEN (OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS NOT OLD.tenant_id)
  OR NEW.wallet_id IS NOT OLD.wallet_id
  OR NEW.user_id IS NOT OLD.user_id
  OR NEW.idempotency_key IS NOT OLD.idempotency_key
  OR NEW.amount_cents IS NOT OLD.amount_cents
  OR NEW.currency IS NOT OLD.currency
BEGIN SELECT RAISE(ABORT,'PAYOUT_REQUEST_IDENTITY_IMMUTABLE'); END;
