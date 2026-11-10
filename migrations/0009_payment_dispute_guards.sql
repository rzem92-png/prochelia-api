-- PROCHÉLIA — serialize open dispute ownership and safe cancellation.
-- Additive enforcement: no second active dispute for one transaction and no
-- resolution of settled/held/missing transactions through the cancellation path.

CREATE TRIGGER IF NOT EXISTS trg_payment_dispute_single_open
BEFORE INSERT ON payment_disputes
WHEN NEW.status='open'
 AND NEW.transaction_id IS NOT NULL
 AND EXISTS (
   SELECT 1 FROM payment_disputes
    WHERE transaction_id=NEW.transaction_id AND status='open'
 )
BEGIN
  SELECT RAISE(ABORT,'PAYMENT_DISPUTE_ALREADY_OPEN');
END;

CREATE TRIGGER IF NOT EXISTS trg_payment_dispute_state_guard
BEFORE UPDATE OF status ON payment_disputes
WHEN NEW.status<>OLD.status
 AND NOT (
   OLD.status='open'
   AND NEW.status='resolved'
   AND NEW.resolution='cancel'
   AND (
     NEW.transaction_id IS NULL
     OR EXISTS (
       SELECT 1 FROM payment_transactions
        WHERE id=NEW.transaction_id AND status='pending'
     )
   )
 )
BEGIN
  SELECT RAISE(ABORT,'PAYMENT_DISPUTE_STATE_CONFLICT');
END;
