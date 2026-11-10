-- PROCHÉLIA — require verified PSP references for financial terminal states.
-- Additive database-level guard: wallet ledger credits/reservations must never be
-- caused by a status-only write that lacks the provider's immutable object ID.

CREATE TRIGGER IF NOT EXISTS trg_payment_tx_paid_requires_provider_reference
BEFORE UPDATE OF status ON payment_transactions
WHEN OLD.status <> 'paid' AND NEW.status = 'paid'
 AND (NEW.provider_payment_id IS NULL OR length(trim(NEW.provider_payment_id)) = 0)
BEGIN
  SELECT RAISE(ABORT,'PAYMENT_SETTLEMENT_REQUIRES_PROVIDER_REFERENCE');
END;

CREATE TRIGGER IF NOT EXISTS trg_payout_status_requires_provider_reference
BEFORE UPDATE OF status ON payout_requests
WHEN OLD.status <> NEW.status
 AND NEW.status IN ('processing','completed','failed','canceled')
 AND (NEW.provider_payout_id IS NULL OR length(trim(NEW.provider_payout_id)) = 0)
BEGIN
  SELECT RAISE(ABORT,'PAYOUT_STATE_REQUIRES_PROVIDER_REFERENCE');
END;

CREATE TRIGGER IF NOT EXISTS trg_payout_request_initial_state_guard
BEFORE INSERT ON payout_requests
WHEN NEW.status <> 'requested'
BEGIN
  SELECT RAISE(ABORT,'PAYOUT_MUST_START_REQUESTED');
END;
