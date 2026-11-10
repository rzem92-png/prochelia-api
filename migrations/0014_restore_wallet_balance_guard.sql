-- PROCHÉLIA — restore the wallet balance invariant when an already-applied
-- 0004 migration is found to have drifted (the trigger is missing).
-- This additive repair is intentionally safe to run on a database where the
-- trigger already exists. It does not alter wallet rows or ledger history.
CREATE TRIGGER IF NOT EXISTS trg_payment_wallet_ledger_guard_balances
BEFORE INSERT ON payment_wallet_ledger
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM wallets WHERE user_id=NEW.user_id)
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
