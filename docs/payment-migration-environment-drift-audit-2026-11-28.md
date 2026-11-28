# Payment migration environment drift audit — 2026-11-28

## Evidence reviewed
- Root `migrations/` directory contains:
  - `0004_atomic_wallet_ledger.sql`
  - `0005_payment_processor_schema.sql`
  - `0005_payment_runtime_schema.sql`
- `tests/test_migrations_sqlite.py` runs the root `migrations/` directory and asserts the payment schema, ledger triggers, immutability and event idempotency.
- `tests/test_payment_migration.py` explicitly runs `migrations/0005_payment_runtime_schema.sql`.
- `wrangler.preview-migrations.jsonc` points to `migrations-preview-canonical/`.
- The inspected canonical Preview migration chain on main contains `0000` through `0022`; it does not include payment runtime/processor schema migrations.
- The guarded Preview migration workflow validates and applies only the canonical list, currently 23 entries.

## Findings
### M-01 — Root payment migration tests do not prove Preview D1 payment schema parity (HIGH, release-blocking if payments are expected in Preview)
The SQLite migration tests validate the root migration directory, while Preview migration is a separate canonical chain. The reviewed canonical Preview chain does not contain the payment processor/runtime schema. Therefore root migration CI success cannot be interpreted as proof that Preview D1 has payment tables/triggers.

**Required:** define the canonical status of payments (deliberately excluded until PSP/ledger integration, or included after reviewed additive migration); add environment-specific schema acceptance checks; test migration chain from an empty SQLite DB and the exact Preview baseline; do not apply to remote DB before the explicit gate.

### M-02 — Two root migration files share prefix `0005` (LOW / maintainability)
Both `0005_payment_processor_schema.sql` and `0005_payment_runtime_schema.sql` create overlapping payment tables, while the runtime migration additionally includes wallet ledger objects. They are additive/idempotent but their shared numeric prefix makes sequencing and intent harder to audit.

**Required:** consolidate/renumber only through a reviewed migration plan that preserves D1's applied migration registry; never rename an already-applied migration in place. Add an explicit migration inventory/order test and schema parity test.

## Release decision
**NO-GO for production payment enablement.** Payment schema may remain intentionally absent from Preview canonical until the settlement implementation is complete, but this must be explicitly documented and enforced. No remote migrations or data writes were performed.
