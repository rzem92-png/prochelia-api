-- PROCHÉLIA — reject direct insertion of already-settled payments without PSP evidence.
-- Complements the UPDATE guard from migration 0011: all paths into the paid state
-- require an immutable provider payment reference before ledger credit can occur.

CREATE TRIGGER IF NOT EXISTS trg_payment_tx_paid_insert_requires_provider_reference
BEFORE INSERT ON payment_transactions
WHEN NEW.status = 'paid'
 AND (NEW.provider_payment_id IS NULL OR length(trim(NEW.provider_payment_id)) = 0)
BEGIN
  SELECT RAISE(ABORT,'PAYMENT_SETTLEMENT_REQUIRES_PROVIDER_REFERENCE');
END;
