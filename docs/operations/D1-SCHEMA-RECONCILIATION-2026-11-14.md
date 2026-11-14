# PROCHÉLIA — D1 schema reconciliation snapshot (2026-11-14)

## Status

**NO-GO for production schema migration.** This document records a read-only snapshot of the Preview and Production D1 schemas. It is not a migration script and authorizes no writes, deployments, or data movement.

Cloudflare D1 databases inspected:
- Preview `prochelia-preview-db`: `6adb95e5-e542-4bec-9008-fbea01042305`
- Production: `04f52830-ef5a-4f17-a640-42bbc2381bba`

## Inventory

| Metric | Preview | Production |
|---|---:|---:|
| User tables (excluding SQLite/Cloudflare internal tables) | 31 | 36 |
| Tables only present in this environment | 15 | 20 |
| Shared table names | 16 | 16 |
| `d1_migrations` | Present (7 rows) | Absent |
| `pricing_catalog` | Absent | Absent |
| `pricing_policies` rows | 0 | 0 |
| `pricing_quotes` rows | 0 | 0 |

### Preview-only tables

`d1_migrations`, `intervenant_route_origins`, `payment_accounts`, `payment_audit`, `payment_disputes`, `payment_reconciliation`, `payment_transactions`, `payment_wallet_ledger`, `payment_webhook_events`, `payout_requests`, `pricing_holidays`, `pricing_route_estimate_audit`, `pricing_route_estimates`, `pricing_travel_policies`, `wallets`.

### Production-only tables

`accounting_ledger`, `activity_journal`, `background_jobs`, `business_expenses`, `business_profiles`, `case_actions`, `commercial_tasks`, `complaints`, `compliance_events`, `copilot_log`, `idempotency_records`, `integration_registry`, `metier_suggestions`, `métier_catalog`, `notification_outbox`, `operational_cases`, `platform_settings`, `recruitment_tasks`, `security_rate_limits`, `system_config_checks`.

## Shared names with material DDL differences

The following shared tables are not structurally interchangeable:

- `clients`: Preview has `created_at` and `updated_at`; Production does not.
- `intervenants`: Preview has `created_at` and `updated_at`; Production does not.
- `prestations`: Preview has `created_at` and `updated_at`; Production does not.
- `pricing_policies`: Preview enforces CHECK constraints on client type and monetary/percentage bounds; Production's corresponding table does not.
- `users`: Production restricts role values with a CHECK constraint and has `status DEFAULT 'pending'`; Preview has no role CHECK and has `status DEFAULT 'active'`. Production's `password_hash` is nullable, whereas Preview requires it to be non-null.

These differences can affect inserts, updates, application assumptions, and any attempt to rebuild or copy tables. They must be reconciled against real data and application code before writing a migration.

## Preview migration history

Preview records these seven migrations, in this order:

1. `0001_core_business_schema.sql`
2. `0002_server_pricing.sql`
3. `0003_route_address_provenance.sql`
4. `0004_atomic_wallet_ledger.sql`
5. `0005_payment_runtime_schema.sql`
6. `0006_restore_wallet_balance_guard.sql`
7. `0007_unique_provider_account.sql`

Production has no `d1_migrations` table, so Wrangler's migration history cannot currently be treated as a trustworthy baseline for Production. The two Preview migration source files for 0006 and 0007 are being restored to Git in draft PR #194; that source restoration does not change either D1 database.

## Required reconciliation strategy

1. Preserve Production-only operational, accounting, compliance, idempotency, and job tables; do not replace Production with a Preview dump.
2. Build a canonical schema inventory from both environments, including columns, indexes, triggers, foreign keys, constraints, and table row counts. Review sensitive tables and data ownership before any transformation.
3. Establish a documented Production baseline that reflects the schema already deployed; do not fabricate historical migration records or mark unapplied SQL as applied without a reviewed baseline procedure.
4. Design additive, idempotent migrations against the canonical target schema. Explicitly handle existing rows, nullability, defaults, CHECK constraints, indexes, and foreign-key dependencies.
5. Test the full migration sequence on an isolated D1 clone/restore target; compare schema and row-level invariants before and after.
6. Exercise application journeys, tenant isolation, payments ledger invariants, backup/restore, and rollback procedures on Preview.
7. Require independent security, privacy, legal, and operational review plus explicit release approval before Production changes.

## Explicit prohibitions until sign-off

- Do not apply Preview migrations directly to Production.
- Do not restore a Preview dump over Production.
- Do not create a fake `d1_migrations` history in Production.
- Do not enable live payment or payout flows based on schema presence alone.
- Do not merge this inventory as evidence that Production is ready.

The current state remains **NO-GO** until a reviewed Production baseline and tested reconciliation plan exist.
