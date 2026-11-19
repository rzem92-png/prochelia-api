# PROCHÉLIA — D1 schema reconciliation snapshot (2026-11-15)

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


## Addendum — read-only validation (2026-11-15)

A further read-only pass was performed after the initial snapshot. No D1 writes, migrations, or deployments were made.

### Integrity checks

- Production PRAGMA quick_check: ok.
- Preview PRAGMA quick_check: ok.
- Production and Preview PRAGMA foreign_key_check: zero returned rows.
- users.password_hash IS NULL: zero rows in both environments.

These checks establish SQLite structural/foreign-key consistency for the inspected snapshots; they do not establish schema equivalence, application correctness, tenant isolation, backup restorability, or release readiness.

### Column-level confirmation

The focused column comparison of the 16 shared table names reconfirmed:

- clients, intervenants, and prestations: Production lacks created_at and updated_at, which exist in Preview.
- users.status: Production default is 'pending'; Preview default is 'active'.
- users.password_hash: nullable in Production, NOT NULL in Preview; the current row-level null count is zero in both environments.

No other column differences were found in the remaining tables included in that 16-table focused comparison. This is not a claim that all DDL differences have been exhausted: CHECK constraints, generated/hidden columns, indexes, triggers, foreign-key actions, collations, and every table definition still require a complete canonical comparison.

### Migration safety finding

migrations/0001_core_business_schema.sql uses CREATE TABLE IF NOT EXISTS for core tables. On an already-existing Production table, that statement does not add columns that are absent from the existing table. Therefore, replaying this migration cannot repair the missing timestamp columns on clients, intervenants, or prestations.

A reconciliation migration must be schema-aware and conditional. It must not blindly issue ALTER TABLE ... ADD COLUMN because Preview already has those columns. SQLite also imposes restrictions on adding columns with non-constant defaults to populated tables. The exact strategy (including backfill, defaults, triggers, or table rebuild where necessary) must be proven on an isolated restored copy before any environment is changed.

### Updated release decision

**NO-GO remains in force.** Do not apply migrations remotely, fabricate Production migration history, merge the stacked schema PRs, deploy, or activate payments until:
1. a complete DDL inventory and reviewed Production baseline exist;
2. a recent encrypted Production backup is restored successfully into the pinned isolated D1 target;
3. the conditional reconciliation is tested against that restored copy with row-count, data-invariant, FK, index, trigger, and application regression checks;
4. independent security, privacy, legal, and operational sign-off is recorded.

The previous inventory and this addendum are evidence of a controlled read-only audit, not a production authorization.


## Addendum 2 — Preview migration ledger recheck (2026-11-15, later read-only pass)

This later direct Cloudflare D1 read supersedes the earlier seven-row Preview migration-history snapshot above. No D1 writes were performed.

Preview database: `prochelia-preview-db` (`6adb95e5-e542-4bec-9008-fbea01042305`).

- `PRAGMA quick_check`: `ok`.
- `PRAGMA foreign_key_check`: zero rows.
- `d1_migrations`: 32 distinct migration names, spanning 19 distinct four-digit numeric prefixes.
- The rate-limit table `auth_login_rate_limits` is absent.
- The rate-limit index `idx_auth_login_rate_limits_window` is absent.

The 32 names returned by the live ledger, in lexical order, were:

```text
0001_core_business_schema.sql
0002_server_pricing.sql
0003_route_address_provenance.sql
0004_atomic_wallet_ledger.sql
0005_payment_runtime_schema.sql
0005_security_rate_limits.sql
0006_copilot_schema.sql
0006_restore_wallet_balance_guard.sql
0007_trust_passport_schema.sql
0007_unique_provider_account.sql
0008_commercial_recruitment_schema.sql
0008_server_owned_pricing_catalog.sql
0009_final_hardening_schema.sql
0009_finance_workspace_schema.sql
0010_identity_mission_security_schema.sql
0010_strategic_schema.sql
0011_final_hardening_schema.sql
0011_strategic_commercial_schema.sql
0012_consolidated_business_schema.sql
0012_national_continuity_schema.sql
0013_finance_workspace_schema.sql
0013_master_complement_schema.sql
0014_operational_schema.sql
0015_commercial_recruitment_schema.sql
0015_production_security_events.sql
0016_national_continuity_schema.sql
0016_security_identity_schema.sql
0017_brand_support_copilot_schema.sql
0017_document_security_scans.sql
0018_consolidated_business_schema.sql
0018_dsa_ai_act_transparency_redress.sql
0019_backup_verifications.sql
```

This proves that the earlier statement "Preview records exactly migrations 0001–0019" was inaccurate. Multiple distinct migration filenames share the same numeric prefix. The exact remote ledger cannot be represented by the single 20-file chain currently pinned by the Preview migration workflow.

### Consequence

The workflow's exact-set comparison is an appropriate fail-closed guard and must not be bypassed. Do not trigger it, do not apply migration 0020, and do not alter the remote ledger until each of the 32 recorded migrations has been traced to its source SQL and the resulting live schema has been compared against the repository's intended canonical schema.

Required next work:
1. Recover and hash the source SQL for all 32 ledger entries from their originating branches/commits or archived build artifacts.
2. Reconstruct the actual application order and dependency graph, including the same-prefix migrations.
3. Compare every table, column, constraint, index, trigger and foreign key with live Preview.
4. Create a reviewed baseline/reconciliation plan and test it on an isolated restored copy.
5. Only then revise and execute a Preview-only migration workflow with backup, target pinning, post-apply verification and rollback evidence.

No production schema migration, deployment, merge, secret change or payment activation is authorized by this addendum. Production remains NO-GO.
