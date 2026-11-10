-- PROCHÉLIA — persist Stripe Accounts v2 recipient capabilities independently.
-- Additive migration; run once through the versioned migration process.
-- Receiving platform transfers does not imply permission to pay out to an external bank account.
ALTER TABLE payment_accounts
  ADD COLUMN transfers_enabled INTEGER NOT NULL DEFAULT 0;
