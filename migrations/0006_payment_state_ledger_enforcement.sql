-- PROCHÉLIA — payment state transitions and wallet ledger enforcement v1
-- Additive only. Apply through the reviewed D1 migration process; never from a request handler.
-- Requires 0004_atomic_wallet_ledger.sql and 0005_payment_processor_schema.sql.
-- Every wallet mutation is caused by an immutable ledger insert inside the same SQLite transaction.

CREATE TRIGGER IF NOT EXISTS trg_payment_tx_status_guard
BEFORE UPDATE OF status ON payment_transactions
WHEN NEW.status <> OLD.status
 AND NOT (
   (OLD.status = 'pending' AND NEW.status IN ('paid','failed','held','canceled'))
   OR (OLD.status = 'paid' AND NEW.status = 'held')
   OR (OLD.status = 'held' AND OLD.provider_payment_id IS NULL AND NEW.status = 'failed')
 )
BEGIN
  SELECT RAISE(ABORT,'PAYMENT_TRANSACTION_STATE_TRANSITION_FORBIDDEN');
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_tx_credit_ledger
AFTER UPDATE OF status ON payment_transactions
WHEN OLD.status = 'pending' AND NEW.status = 'paid'
 AND NEW.type = 'MISSION_CHARGE'
BEGIN
  INSERT INTO payment_wallet_ledger
    (id,idempotency_key,transaction_id,user_id,entry_type,available_delta_cents,currency,metadata_json)
  VALUES
    ('ledger:mission-paid:' || NEW.id,
     'mission-paid:' || NEW.id,
     NEW.id,NEW.intervenant_id,'MISSION_PAYMENT_SETTLED',
     NEW.net_intervenant_cents,NEW.currency,
     '{"source":"verified_payment_webhook"}');
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_tx_hold_ledger
AFTER UPDATE OF status ON payment_transactions
WHEN OLD.status = 'paid' AND NEW.status = 'held'
 AND NEW.type = 'MISSION_CHARGE'
BEGIN
  INSERT INTO payment_wallet_ledger
    (id,idempotency_key,transaction_id,user_id,entry_type,available_delta_cents,reserved_delta_cents,currency,metadata_json)
  VALUES
    ('ledger:mission-held:' || NEW.id,
     'mission-held:' || NEW.id,
     NEW.id,NEW.intervenant_id,'MISSION_PAYMENT_HELD',
     -NEW.net_intervenant_cents,NEW.net_intervenant_cents,NEW.currency,
     '{"source":"dispute_hold"}');
END;


-- If an administrator held a still-pending charge and the PSP later confirms
-- success, reserve the proceeds rather than making them withdrawable.
CREATE TRIGGER IF NOT EXISTS trg_payment_tx_settle_held_ledger
AFTER UPDATE OF provider_payment_id ON payment_transactions
WHEN OLD.status = 'held'
 AND NEW.status = 'held'
 AND OLD.provider_payment_id IS NULL
 AND NEW.provider_payment_id IS NOT NULL
 AND NEW.type = 'MISSION_CHARGE'
BEGIN
  INSERT INTO payment_wallet_ledger
    (id,idempotency_key,transaction_id,user_id,entry_type,reserved_delta_cents,currency,metadata_json)
  VALUES
    ('ledger:mission-held-settled:' || NEW.id,
     'mission-held-settled:' || NEW.id,
     NEW.id,NEW.intervenant_id,'MISSION_PAYMENT_SETTLED_HELD',
     NEW.net_intervenant_cents,NEW.currency,
     '{"source":"verified_payment_webhook_after_hold"}');
END;

CREATE TRIGGER IF NOT EXISTS trg_payout_request_guard
BEFORE INSERT ON payout_requests
BEGIN
  SELECT CASE
    WHEN NEW.amount_cents <= 0
      THEN RAISE(ABORT,'PAYOUT_AMOUNT_INVALID')
    WHEN NOT EXISTS (
      SELECT 1 FROM wallets
       WHERE id=NEW.wallet_id
         AND user_id=NEW.user_id
         AND currency=NEW.currency
    )
      THEN RAISE(ABORT,'PAYOUT_WALLET_NOT_FOUND_OR_CURRENCY_MISMATCH')
    WHEN (SELECT available_cents FROM wallets WHERE id=NEW.wallet_id) < NEW.amount_cents
      THEN RAISE(ABORT,'PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_payout_request_reserve_ledger
AFTER INSERT ON payout_requests
WHEN NEW.status = 'requested'
BEGIN
  INSERT INTO payment_wallet_ledger
    (id,idempotency_key,payout_id,user_id,entry_type,available_delta_cents,reserved_delta_cents,currency,metadata_json)
  VALUES
    ('ledger:payout-reserve:' || NEW.id,
     'payout-reserve:' || NEW.id,
     NEW.id,NEW.user_id,'PAYOUT_RESERVED',
     -NEW.amount_cents,NEW.amount_cents,NEW.currency,
     '{"source":"payout_request"}');
END;

CREATE TRIGGER IF NOT EXISTS trg_payout_status_guard
BEFORE UPDATE OF status ON payout_requests
WHEN NEW.status <> OLD.status
 AND NOT (
   (OLD.status = 'requested' AND NEW.status IN ('processing','completed','failed','canceled'))
   OR (OLD.status = 'processing' AND NEW.status IN ('completed','failed','canceled'))
 )
BEGIN
  SELECT RAISE(ABORT,'PAYOUT_STATE_TRANSITION_FORBIDDEN');
END;

CREATE TRIGGER IF NOT EXISTS trg_payout_settle_ledger
AFTER UPDATE OF status ON payout_requests
WHEN OLD.status IN ('requested','processing') AND NEW.status = 'completed'
BEGIN
  INSERT INTO payment_wallet_ledger
    (id,idempotency_key,payout_id,user_id,entry_type,reserved_delta_cents,paid_delta_cents,currency,metadata_json)
  VALUES
    ('ledger:payout-paid:' || NEW.id,
     'payout-paid:' || NEW.id,
     NEW.id,NEW.user_id,'PAYOUT_SETTLED',
     -NEW.amount_cents,NEW.amount_cents,NEW.currency,
     '{"source":"verified_payout_webhook"}');
END;

CREATE TRIGGER IF NOT EXISTS trg_payout_release_ledger
AFTER UPDATE OF status ON payout_requests
WHEN OLD.status IN ('requested','processing') AND NEW.status IN ('failed','canceled')
BEGIN
  INSERT INTO payment_wallet_ledger
    (id,idempotency_key,payout_id,user_id,entry_type,available_delta_cents,reserved_delta_cents,currency,metadata_json)
  VALUES
    ('ledger:payout-release:' || NEW.id,
     'payout-release:' || NEW.id,
     NEW.id,NEW.user_id,'PAYOUT_RELEASED',
     NEW.amount_cents,-NEW.amount_cents,NEW.currency,
     '{"source":"verified_payout_webhook"}');
END;
