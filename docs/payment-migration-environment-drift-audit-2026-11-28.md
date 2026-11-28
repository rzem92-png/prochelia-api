# Payment migration environment drift audit — 2026-11-28

## Evidence reviewed

- Root `migrations/` contains `0004_atomic_wallet_ledger.sql`, `0005_payment_processor_schema.sql`, and `0005_payment_runtime_schema.sql`. Two root migration files share prefix `0005`; the runtime file adds objects beyond the processor schema.
- `tests/test_migrations_sqlite.py` exercises the root migration directory; `tests/test_payment_migration.py` explicitly applies `0005_payment_runtime_schema.sql`.
- `wrangler.preview-migrations.jsonc` selects `migrations-preview-canonical/`, not the root directory. The reviewed canonical chain has 23 entries, `0000` through `0022`.
- Direct read-only Cloudflare D1 query of Preview (`e3cf167c-37e1-4d72-9ac6-b3e27c14b97f), 28 Nov 2026) counted **94 application tables** and read the migration registry. Cloudflare D1 list metadata returned `num_tables=0`, which conflicts with the direct SQL inventory and is not accepted as schema evidence.
- Preview migration registry: `0000` through `0022` (23 recorded entries).
- Direct read-only Preview schema query confirms `paiements`, `payment_wallet_ledger`, `wallets`, and `accounting_ledger`; it does **not** show `payment_processor_events`, `payment_intents`, or a tenant table family.
- Direct read-only Production D1 query (`04f52830-ef5a-4f17-a640-42bbc2381bba)) counted **37 application tables**. It has `paiements` and `accounting_ledger`, but no `payment_wallet_ledger`, no tenant table family, and no `d1_migrations` table (querying that registry returns `no such table`).
- The isolated restore-validation DB contains only Cloudflare's internal `_cf_KV` table; this is not evidence of a restored application database.

## Findings

### M-01 — Migration and settlement-schema parity is not established (HIGH, release-blocking)
Root migration tests do not prove that the Preview canonical chain or Production DB contain the full processor/intent/settlement schema. Preview does contain the wallet-ledger and payment tables listed above; the earlier broader claim that Preview lacked all payment runtime schema was too imprecise. The missing processor/intent objects and Production differences remain material.

**Required:** decide which payment objects are intentionally present before PSP/settlement readiness; define an explicit schema acceptance contract per environment; test the canonical chain from an empty DB and the exact baseline; reconcile Production's actual schema without assuming a migration history. No remote migration until the explicit human gate.

### M-02 — Production migration history absent (HIGH)
Production has no `d1_migrations` registry. Table inventory and migration history cannot be assumed to match repository files.

**Required:** snapshot/backup first; establish provenance and a reviewed reconciliation plan against the live schema; validate on a copy; no automatic history stamping or migration application.

### M-03 — Duplicate root migration prefix `0005` (LOW / maintainability)
`0005_payment_processor_schema.sql` and `0005_payment_runtime_schema.sql` overlap. They are additive/idempotent in the reviewed tests, but the shared prefix makes ordering and intent harder to audit.

**Required:** renumber/consolidate only through a reviewed migration plan that preserves D1's applied migration registry; never rename an applied migration in place. Add migration inventory/order and schema-parity tests.

## Release decision

**NO-GO for production payment activation.** A payment table or ledger in D1 is not proof of operational settlement. PSP adapter, provider-native webhook validation, replay/freshness, atomic ledger/wallet settlement, reconciliation, refunds/disputes/payouts, sandbox E2E, security, and legal/PSP review remain required.

No remote migrations, data writes, production exports, secrets, PSP configuration, deployment, or financial state were changed during this audit.
