-- PROCHÉLIA — PSP object references are write-once evidence.
-- A provider object ID may be attached once to a pending record, but must never
-- be replaced or cleared after persistence. This preserves webhook/reconciliation identity.

CREATE TRIGGER IF NOT EXISTS trg_payment_tx_paid_reference_immutable
BEFORE UPDATE OF provider_payment_id ON payment_transactions
WHEN OLD.provider_payment_id IS NOT NULL
 AND length(trim(OLD.provider_payment_id)) > 0
 AND NEW.provider_payment_id IS NOT OLD.provider_payment_id
BEGIN
  SELECT RAISE(ABORT,'PAYMENT_PROVIDER_REFERENCE_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_payout_provider_reference_immutable
BEFORE UPDATE OF provider_payout_id ON payout_requests
WHEN OLD.provider_payout_id IS NOT NULL
 AND length(trim(OLD.provider_payout_id)) > 0
 AND NEW.provider_payout_id IS NOT OLD.provider_payout_id
BEGIN
  SELECT RAISE(ABORT,'PAYOUT_PROVIDER_REFERENCE_IMMUTABLE');
END;
