-- PROCHÉLIA — a payment transaction cannot be inserted already settled.
-- Settlement must be a guarded transition from a non-terminal state so the
-- existing ledger triggers can atomically apply the corresponding wallet credit.

CREATE TRIGGER IF NOT EXISTS trg_payment_tx_paid_insert_state_guard
BEFORE INSERT ON payment_transactions
WHEN NEW.status = 'paid'
BEGIN
  SELECT RAISE(ABORT,'PAYMENT_SETTLEMENT_MUST_TRANSITION');
END;
