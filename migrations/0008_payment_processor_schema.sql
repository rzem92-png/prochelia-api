-- PROCHÉLIA — PSP payment transaction and payout schema
-- Versioned, additive, idempotent schema. No existing rows are modified.
-- Wallet balances and immutable ledger are created by 0004_atomic_wallet_ledger.sql.

CREATE TABLE IF NOT EXISTS payment_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  onboarding_status TEXT NOT NULL DEFAULT 'required',
  payouts_enabled INTEGER NOT NULL DEFAULT 0,
  charges_enabled INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  mission_id TEXT,
  client_id TEXT,
  intervenant_id TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  gross_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  provider_fee_cents INTEGER NOT NULL DEFAULT 0,
  refund_cents INTEGER NOT NULL DEFAULT 0,
  net_intervenant_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  provider TEXT,
  provider_payment_id TEXT,
  provider_payout_id TEXT,
  reason TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_mission
  ON payment_transactions(mission_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_tx_intervenant
  ON payment_transactions(intervenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS payout_requests (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  wallet_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  mode TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'requested',
  provider TEXT,
  provider_payout_id TEXT,
  failure_code TEXT,
  failure_message TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payout_user
  ON payout_requests(user_id, status, requested_at);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature_valid INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  payload_hash TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  UNIQUE(provider, event_id)
);

CREATE TABLE IF NOT EXISTS payment_disputes (
  id TEXT PRIMARY KEY,
  mission_id TEXT,
  transaction_id TEXT,
  client_id TEXT,
  intervenant_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  reason TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  resolution TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_reconciliation (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  internal_transaction_id TEXT,
  internal_payout_id TEXT,
  amount_cents INTEGER,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'unmatched',
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, external_id)
);

CREATE TABLE IF NOT EXISTS payment_audit (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  transaction_id TEXT,
  payout_id TEXT,
  mission_id TEXT,
  user_id TEXT,
  result TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
