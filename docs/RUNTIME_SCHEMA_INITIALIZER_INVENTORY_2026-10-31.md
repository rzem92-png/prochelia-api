# PROCHÉLIA — runtime schema initializer inventory

**Date:** 2026-10-31  
**Branch:** `audit/preprod-release-gate-20261031`  
**Purpose:** read-only source inventory to plan safe removal of request-time DDL.  
**Disposition:** investigation only; this file does not authorize migrations, database writes, initializer removal, deployment or PR merge.

## Evidence and method

The inventory was derived from `src/index.js` on the audit branch by locating each of the 13 `async function ensure*Schema(env)` definitions and scanning its function body for literal `CREATE TABLE`, `CREATE INDEX`, `CREATE TRIGGER`, `ALTER TABLE` and `INSERT INTO` statements. It is a source-level declaration inventory, not a full SQL parser and not proof of live D1 parity. Dynamic SQL, conditional branches, statements assembled outside the initializer body, seed value differences and dependencies require a second pass.

The initial scan produced one non-object token (`m`) from a SQL/template parsing boundary. It is deliberately excluded from the object inventory and marked as a parser anomaly to investigate, not treated as a table.

## Initializer inventory

| Initializer | Literal table declarations | Indexes | Triggers | ALTER TABLE | Seed targets |
|---|---:|---:|---:|---:|---|
| `ensureSecuritySchema` | 5 | 4 | 0 | 0 | — |
| `ensureTrustPassportSchema` | 2 | 1 | 0 | 0 | — |
| `ensurePaymentSchema` | 10 | 6 | 5 | 0 | — |
| `ensureConsolidatedSchema` | 20 | 4 | 0 | 0 | `pricing_holidays`, `platform_settings` |
| `ensureStrategicSchema` | 6 | 4 | 0 | 0 | — |
| `ensureOperationalSchema` | 9 | 3 | 0 | 1 | — |
| `ensureFinalHardeningSchema` | 5 | 2 | 0 | 0 | — |
| `ensureCommercialRecruitmentSchema` | 5 | 2 | 0 | 0 | — |
| `ensureFinanceWorkspaceSchema` | 3 | 4 | 0 | 0 | — |
| `ensureDocumentSecuritySchema` | 1 | 1 | 0 | 0 | — |
| `ensureNationalContinuitySchema` | 3 | 3 | 0 | 0 | `platform_scale_config` |
| `ensureProcheliaMasterComplementSchema` | 7 | 4 | 0 | 0 | `brand_identity`, `interface_profiles`, `copilot_resolution_rules` |
| `ensureCopilotSchema` | 2 | 2 | 0 | 0 | — |

**Observed totals:** 78 literal table declarations after excluding the parser anomaly; 36 literal index declarations; 5 trigger declarations; 1 ALTER TABLE statement; 6 seed target tables. Declarations may repeat an object already defined in another initializer. These totals are not unique object counts and must not be used as migration counts.

## Literal table names by initializer

- `ensureSecuritySchema`: `identity_verifications`, `trusted_devices`, `mission_security`, `mission_security_attempts`, `security_audit`.
- `ensureTrustPassportSchema`: `trust_service_catalog`, `trust_verifications`.
- `ensurePaymentSchema`: `payment_accounts`, `wallets`, `payment_wallet_ledger`, `payment_transactions`, `payout_requests`, `payment_webhook_events`, `payment_provider_references`, `payment_disputes`, `payment_reconciliation`, `payment_audit`.
- `ensureConsolidatedSchema`: `platform_settings`, `business_profiles`, `metier_suggestions`, `pricing_policies`, `pricing_travel_policies`, `pricing_route_estimates`, `pricing_route_estimate_audit`, `pricing_holidays`, `pricing_quotes`, `operational_cases`, `case_actions`, `copilot_log`, `activity_journal`, `commercial_tasks`, `recruitment_tasks`, `complaints`, `accounting_ledger`, `business_expenses`, `notification_outbox`, `compliance_events`.
- `ensureStrategicSchema`: `promotions`, `promotion_recommendations`, `commercial_events`, `market_signals`, `client_value_scores`, `strategic_alerts`.
- `ensureOperationalSchema`: `action_outbox`, `copilot_briefings`, `loyalty_events`, `loyalty_balances`, `quality_events`, `b2b_leads`, `capacity_snapshots`, `finance_forecasts`, `system_checks`.
- `ensureFinalHardeningSchema`: `system_config_checks`, `idempotency_records`, `background_jobs`, `security_rate_limits`, `integration_registry`.
- `ensureCommercialRecruitmentSchema`: `commercial_prospects`, `commercial_playbooks`, `recruitment_candidates`, `copilot_growth_actions`, `sales_results`.
- `ensureFinanceWorkspaceSchema`: `finance_workspace_entries`, `finance_export_log`, `finance_resolution_cases`.
- `ensureDocumentSecuritySchema`: `document_security_scans`.
- `ensureNationalContinuitySchema`: `platform_scale_config`, `backup_runs`, `backup_objects`.
- `ensureProcheliaMasterComplementSchema`: `brand_identity`, `brand_assets`, `brand_clearance_log`, `interface_profiles`, `support_cases`, `support_case_events`, `copilot_resolution_rules`.
- `ensureCopilotSchema`: `copilot_interactions`, `copilot_action_plans`.

## Existing migration overlap (name-level only)

The existing migrations visibly declare 21 tables, 15 indexes and 5 triggers. Name-level overlap includes:

- `0001_core_business_schema.sql`: core marketplace tables, not a demonstrated replacement for the security/trust/payment/operations initializers.
- `0002_server_pricing.sql`: pricing objects overlap with the consolidated initializer, but matching column definitions, indexes, checks and seed values have not been proven.
- `0003_route_address_provenance.sql`: separate route-origin table; no equivalence to the 13 initializer set established.
- `0004_atomic_wallet_ledger.sql`: `wallets` and `payment_wallet_ledger` plus five ledger triggers overlap with payment initializer. Exact SQL and trigger-body parity must be compared.
- `0005_security_rate_limits.sql`: `security_rate_limits` overlaps with final-hardening initializer. Exact column/index/check parity must be compared.

**No initializer is safe to remove on name overlap alone.** A matching table name does not prove matching columns, nullability, defaults, CHECK/UNIQUE constraints, foreign keys, indexes, triggers, seed data or ordering.

## Required next proof

1. Extract each complete SQL statement with a SQL-aware parser; preserve multi-statement triggers and template interpolation.
2. Include all non-DDL side effects, especially seed/configuration inserts, `ALTER TABLE`, conditional statements and writes outside initializers.
3. Build canonical object fingerprints for tables, indexes and triggers, including ordered columns and constraints.
4. Map every statement to an immutable ordered migration or explicitly classified runtime data operation. Unparsed or unmapped statements block.
5. Compare against a schema-only export of the explicitly identified isolated preproduction D1, read-only; never copy personal data into CI logs or the repository.
6. Test fresh install, supported upgrade paths, idempotent seeds, foreign keys, wallet/ledger invariants, failure injection, encrypted backup and restore to a separate disposable database.
7. Only then propose removal of request-time schema creation as a separate reviewed change.

## Safety boundary

No D1 query or write was run to produce this report. No migration was applied. No initializer was removed. No Worker was deployed. PR #15 remains draft/unmerged. Production remains NO-GO.


## Additional parity hazards found in targeted source comparison

A targeted comparison of the payment, pricing and hardening initializer bodies against migrations found differences that make blind initializer removal unsafe:

1. **Runtime index deletion:** `ensureConsolidatedSchema` contains `DROP INDEX IF EXISTS idx_pricing_travel_policy_active`, followed by recreation of a partial unique index with that name. This is a request-time schema mutation with a destructive index-drop step. The current migration `0002_server_pricing.sql` instead creates `idx_pricing_travel_policy_active_unique` and explicitly says it preserves any legacy index. These are not identical object histories or names. A migration plan must verify duplicate data and both index definitions before choosing a safe expand/contract path.
2. **Route estimate constraint mismatch:** the runtime initializer's `pricing_route_estimates.status` column is `TEXT NOT NULL DEFAULT 'VALID'` without a CHECK in the excerpt; migration 0002 adds `CHECK (status IN ('VALID','EXPIRED','REVOKED'))`. The migration is stricter. Existing rows and all write paths must be checked before treating the schemas as interchangeable.
3. **Holiday seed behavior:** runtime and migration both seed holiday rows, but full date/value parity and idempotency have not been programmatically compared. Do not assume the seed sets are identical.
4. **Rate-limit constraint mismatch:** runtime `security_rate_limits.request_count` is declared `INTEGER NOT NULL DEFAULT 0` while migration 0005 adds `CHECK (request_count >= 0)`. This is a real schema-contract difference requiring an explicit compatibility decision.
5. **Wallet trigger parity:** the initializer and migration both declare the five wallet-ledger triggers by name. This inspection did not compare normalized complete trigger bodies, so equivalence remains UNPROVEN.

These findings are source-level comparisons only. No database was queried, no SQL was executed and no data state was inferred.
