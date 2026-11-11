-- PROCHÉLIA — prevent one PSP account from being attached to multiple users.
-- Existing NULL/empty provider account IDs remain allowed until onboarding completes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_accounts_provider_account
  ON payment_accounts(provider,provider_account_id)
  WHERE provider_account_id IS NOT NULL AND provider_account_id <> '';
