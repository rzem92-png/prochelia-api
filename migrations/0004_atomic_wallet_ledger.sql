-- PROCHÉLIA V14.5.7 — ledger portefeuille idempotent et application atomique
-- Chaque mouvement financier est append-only. Le trigger applique les deltas au portefeuille
-- dans la même transaction SQLite que l'insertion du mouvement.
CREATE TABLE IF NOT EXISTS payment_wallet_ledger (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  transaction_id TEXT,
  payout_id TEXT,
  user_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  available_delta_cents INTEGER NOT NULL DEFAULT 0,
  pending_delta_cents INTEGER NOT NULL DEFAULT 0,
  reserved_delta_cents INTEGER NOT NULL DEFAULT 0,
  paid_delta_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_date ON payment_wallet_ledger(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_tx ON payment_wallet_ledger(transaction_id,entry_type);
CREATE TRIGGER IF NOT EXISTS trg_payment_wallet_ledger_require_wallet
BEFORE INSERT ON payment_wallet_ledger
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM wallets
       WHERE user_id=NEW.user_id AND currency=NEW.currency
    )
    THEN RAISE(ABORT,'PAYMENT_WALLET_NOT_FOUND_OR_CURRENCY_MISMATCH')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_wallet_ledger_apply
AFTER INSERT ON payment_wallet_ledger
BEGIN
  UPDATE wallets SET
    available_cents=available_cents+NEW.available_delta_cents,
    pending_cents=pending_cents+NEW.pending_delta_cents,
    reserved_cents=reserved_cents+NEW.reserved_delta_cents,
    paid_cents=paid_cents+NEW.paid_delta_cents,
    updated_at=CURRENT_TIMESTAMP
  WHERE user_id=NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_wallet_ledger_no_update
BEFORE UPDATE ON payment_wallet_ledger
BEGIN
  SELECT RAISE(ABORT,'PAYMENT_WALLET_LEDGER_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_payment_wallet_ledger_no_delete
BEFORE DELETE ON payment_wallet_ledger
BEGIN
  SELECT RAISE(ABORT,'PAYMENT_WALLET_LEDGER_IMMUTABLE');
END;
