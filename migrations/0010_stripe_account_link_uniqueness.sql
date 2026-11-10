-- PROCHÉLIA — prevent one Stripe connected account from being linked to multiple local users.
-- Additive, non-destructive guard. If existing duplicate mappings exist, this migration
-- intentionally fails and requires explicit reconciliation before it can be applied.
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_accounts_provider_account
ON payment_accounts(provider, provider_account_id)
WHERE provider_account_id IS NOT NULL AND provider_account_id <> '';
