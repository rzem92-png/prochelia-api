-- PROCHÉLIA — restore the missing wallet ledger balance guard.
-- Additive and idempotent. Repairs databases where migration 0004 was recorded
-- but trg_payment_wallet_ledger_guard_balances is absent.
CREATE TRIGGER IF NOT EXISTS trg_payment_wallet_ledger_guard_balances
BEFORE INSERT ON payment_wallet_ledger
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM wallets
       WHERE user_id=NEW.user_id AND currency=NEW.currency
    )
    THEN RAISE(ABORT,'PAYMENT_WALLET_NOT_FOUND')
    WHEN typeof((SELECT available_cents FROM wallets WHERE user_id=NEW.user_id)+NEW.available_delta_cents) <> 'integer'
      OR typeof((SELECT pending_cents FROM wallets WHERE user_id=NEW.user_id)+NEW.pending_delta_cents) <> 'integer'
      OR typeof((SELECT reserved_cents FROM wallets WHERE user_id=NEW.user_id)+NEW.reserved_delta_cents) <> 'integer'
      OR typeof((SELECT paid_cents FROM wallets WHERE user_id=NEW.user_id)+NEW.paid_delta_cents) <> 'integer'
      THEN RAISE(ABORT,'PAYMENT_WALLET_INTEGER_OVERFLOW')
    WHEN (SELECT pending_cents FROM wallets WHERE user_id=NEW.user_id)+NEW.pending_delta_cents < 0
      OR (SELECT reserved_cents FROM wallets WHERE user_id=NEW.user_id)+NEW.reserved_delta_cents < 0
      OR (SELECT paid_cents FROM wallets WHERE user_id=NEW.user_id)+NEW.paid_delta_cents < 0
      THEN RAISE(ABORT,'PAYMENT_WALLET_NEGATIVE_PROTECTED_BALANCE')
  END;
END;
