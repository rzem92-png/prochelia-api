# PROCHÉLIA — D1 schema migration and readiness plan

**Status:** investigation and execution plan only. No SQL migration has been applied by this document.  
**Target:** isolated preproduction D1 first. Production remains out of scope without explicit owner approval.

## 0. Latest CI evidence snapshot — 2026-10-31

This section supersedes stale version and test-count statements in earlier investigation notes below.

- Audited branch head: `ee23510ee458cc2bb430d5ba75b81447ec4d369b`.
- Worker version constant: `V14.5.8-EXPERT-PREPRODUCTION`.
- Migration `0005_security_rate_limits.sql` release marker: `V14.5.8`.
- GitHub Actions release-gate run: `41217091196` — 133 tests passed, 0 failed; static release audit reported 12 passed / 1 blocked.
- The sole static blocker in that run: 83 runtime DDL call sites across the 13 initializer functions listed below.
- CodeQL run `41217091200` was still in progress when this snapshot was recorded; do not mark it passed until GitHub reports a completed success.
- Pull request #15 remains draft and unmerged. No D1 command, migration, restore, or deployment was executed by this audit.

The 133 passing tests are regression evidence only. They do not prove that a live D1 database has the expected schema, that all initializer DDL has an equivalent migration, or that restore/recovery works. The static audit remains NO-GO.

## 1. Verified code findings

At the audited prelaunch code:
- Worker source is `src/index.js`.
- Earlier baseline Worker version was `V14.5.7-EXPERT-PREPRODUCTION`; the current audited branch head is `V14.5.8-EXPERT-PREPRODUCTION`.
- `migrations/0005_security_rate_limits.sql` identifies itself as V14.5.8 and creates `security_rate_limits`.
- The release audit detects 83 runtime DDL call sites matching `await ensure*Schema(env)`, across 13 distinct schema initializer functions.
- The current audited `/api/readiness` endpoint checks the declared required-table inventory read-only; this is not yet a full column/index/constraint/trigger compatibility proof against live D1.
- `wrangler.jsonc` points at the preview database `prochelia-preview-db` (ID `6adb95e5-e542-4bec-9008-fbea01042305`) and a preview R2 bucket. This is configuration evidence only; it is not evidence of the live D1 schema or a successful backup/restore.

## 1A. Source-derived initializer and migration inventory — 2026-10-31

### 13 schema initializers found in src/index.js

| Initializer | Source line in audited snapshot | Domain |
|---|---:|---|
| ensureSecuritySchema | 511 | Identity, device/session and mission security, audit |
| ensureTrustPassportSchema | 678 | Service catalogue and provider evidence |
| ensurePaymentSchema | 966 | Payment accounts, wallets, ledger, transactions, provider events |
| ensureConsolidatedSchema | 1615 | Platform/business configuration, métiers, pricing, quotes, cases |
| ensureStrategicSchema | 2401 | Promotions, recommendations, commercial events, market signals |
| ensureOperationalSchema | 2815 | Outbox, Copilot briefings, loyalty, quality, B2B leads |
| ensureFinalHardeningSchema | 3144 | System checks, idempotency and job controls |
| ensureCommercialRecruitmentSchema | 3302 | Commercial and recruitment workflows |
| ensureFinanceWorkspaceSchema | 3463 | Finance workspace and resolution cases |
| ensureDocumentSecuritySchema | 3777 | Document security and scan state |
| ensureNationalContinuitySchema | 4122 | Continuity, backup and resilience records |
| ensureProcheliaMasterComplementSchema | 4366 | Master/reference and operating structures |
| ensureCopilotSchema | 4587 | Copilot interactions and action plans |

The 83 count reported by the release gate is a runtime call-site count, not a count of unique SQL statements or schema objects. Line numbers are locators for this snapshot and must be regenerated from the exact commit before review.

### Existing migration object inventory

A preliminary declaration scan of the five existing migrations found the following objects. This is not yet proof of equivalence with initializer DDL; parsing must be repeated with a SQL-aware parser that preserves multi-statement triggers.

| Migration | Declared objects found |
|---|---|
| 0001_core_business_schema.sql | Tables: clients, intervenants, prestations, missions, tarifs, paiements, disponibilites, evaluations, documents, conflits, journal. Indexes: idx_clients_user, idx_intervenants_user, idx_missions_client, idx_missions_intervenant, idx_missions_date, idx_disponibilites_intervenant, idx_paiements_mission, idx_journal_user |
| 0002_server_pricing.sql | Tables: pricing_policies, pricing_travel_policies, pricing_route_estimates, pricing_route_estimate_audit, pricing_holidays, pricing_quotes. Indexes: idx_pricing_policy_lookup, idx_pricing_route_owner_expiry |
| 0003_route_address_provenance.sql | Table: intervenant_route_origins. Index: idx_intervenant_route_origin_status |
| 0004_atomic_wallet_ledger.sql | Tables: wallets, payment_wallet_ledger. Indexes: idx_wallet_ledger_user_date, idx_wallet_ledger_tx. Triggers: trg_payment_wallet_ledger_require_wallet, trg_payment_wallet_ledger_guard_balances, trg_payment_wallet_ledger_apply, trg_payment_wallet_ledger_no_update, trg_payment_wallet_ledger_no_delete |
| 0005_security_rate_limits.sql | Table: security_rate_limits. Index: idx_security_rate_limits_window |

**Coverage status: NOT PROVEN.** Existing migrations visibly cover core marketplace, pricing, route provenance, wallet ledger and persistent rate limiting. This scan does not establish complete equivalence for all objects created by all 13 initializers. No initializer is removed and no migration is authored on this evidence alone.

### Required machine-readable proof before migration drafting

Build a normalized manifest from actual initializer SQL arrays/template literals containing:
- object type/name and normalized SQL hash;
- columns, defaults, CHECK/UNIQUE/PRIMARY KEY constraints;
- foreign keys and referenced objects;
- index uniqueness and ordered columns;
- trigger timing/event/body and protected invariants;
- ALTER TABLE, seed/configuration writes and conditional DDL;
- initializer, all call sites, route/method and owning module;
- matching migration filename and exact statement hash, or explicit UNMAPPED.

Preserve multi-statement trigger bodies and dynamic SQL. Mark any unparseable statement UNPARSED; never silently omit it. CI must fail if new initializer DDL appears without a reviewed manifest mapping.

## 2. Hard safety boundaries

- Do not run `wrangler d1 migrations apply`, `wrangler d1 execute`, SQL writes, remote restore, or deployment as part of this audit.
- Do not use the preview database ID as evidence that it is safe to mutate. Confirm the exact account, environment, database name and owner approval before any remote operation.
- Export and inspect schema read-only first; obtain a verified encrypted backup and a separate isolated restore test before any migration.
- No destructive SQL, table rebuild, data rewrite, or production action without a reviewed change plan, tested rollback/recovery path, and explicit approval.
- Runtime schema creation must be removed only after every initializer has been mapped to an ordered migration and the target schema has been compared.

## 3. Inventory work required before authoring migrations

Capture from the isolated preproduction D1, read-only:
1. `PRAGMA user_version` and D1 migration history (where supported).
2. `sqlite_master` definitions for tables, indexes, triggers and views.
3. `PRAGMA table_info(table)` for every table.
4. `PRAGMA foreign_key_list(table)` and `PRAGMA index_list(table)`.
5. Row counts and privacy-safe deterministic fingerprints for critical business tables.
6. `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.
7. Existing backup manifest, hash, encryption metadata and independent restore evidence.

Do not export personal data into the repository or CI logs. Schema-only evidence belongs in the audit artifact; row-level production data does not.

## 4. Runtime initializer decomposition

Map all 13 initializers and every call site to:
- exact DDL statements and constraints;
- owning module and endpoints;
- dependencies and foreign keys;
- whether it changes only schema or also seeds/configures data;
- required indexes, uniqueness and triggers;
- backward-compatibility requirements;
- data migration and rollback/recovery strategy.

Initializers detected by the static audit:
- ensureSecuritySchema
- ensureTrustPassportSchema
- ensurePaymentSchema
- ensureOperationalSchema
- ensureConsolidatedSchema
- ensureStrategicSchema
- ensureFinalHardeningSchema
- ensureCommercialRecruitmentSchema
- ensureFinanceWorkspaceSchema
- ensureDocumentSecuritySchema
- ensureNationalContinuitySchema
- ensureProcheliaMasterComplementSchema
- ensureCopilotSchema

No blind concatenation of these functions into one giant SQL file. Split migrations by domain, dependency order, and risk. Review every DDL statement and seed operation.

## 5. Required module readiness contract

The readiness endpoint must verify schema and required dependencies for each enabled module, at minimum:
- core identity, users, sessions and role/permission model;
- clients and provider profiles;
- missions, availability, mission status and service catalogue;
- pricing policies, quotes, promotions and financial ledger;
- payment transactions, webhook event idempotency and payout states;
- identity verification and service-specific qualifications/insurance/authorizations;
- security audit and persistent rate-limit storage;
- document metadata, private object storage references and malware scan state;
- Trust Passport catalogue and verification evidence;
- Copilot interaction/action audit and approval state;
- backup manifests, restore verification and retention state.

The exact table/column list must be derived from SQL statements and the real D1 inventory, not from guessed table names. Missing, incompatible or unknown schema must return not-ready and must not silently create schema.

## 6. Versioning and migration discipline

- Establish one canonical release version shared by Worker metadata, migration release notes, package metadata, build artifact and deployment record.
- Do not assume migration number equals application version.
- Migration history must be immutable and ordered; never edit a migration already applied to any environment.
- Use additive expand/contract changes: add nullable/compatible structures, deploy code that supports old and new schema, backfill in bounded batches, verify, then remove obsolete schema only in a separately approved release.
- Every migration requires SQL review, SQLite/D1 compatibility test, pre/post schema snapshot, row-count/fingerprint comparison, idempotency/replay test where applicable, failure injection and recovery plan.
- Test on a disposable isolated D1 created for CI. Never point CI at shared preview or production D1.

## 7. Migration test matrix

CI must:
- create a fresh disposable SQLite/D1-compatible database;
- apply all migrations in order from empty state;
- verify no duplicate object names and no missing dependencies;
- apply the migration set a second time only where explicitly designed as replay-safe;
- run schema contract checks against the Worker SQL usage;
- run module integration tests and authorization tests;
- inject a failed migration and verify the environment is marked blocked;
- test old-version/new-schema and new-version/old-schema compatibility where supported;
- verify ledger immutability, wallet reconciliation and foreign keys;
- export backup, restore to a different isolated DB, compare schema, integrity, counts and fingerprints;
- retain redacted reports, commit SHA, tool versions and run IDs.

## 8. Release blockers

No release until:
- all runtime initializer calls have been removed from request paths and their schema changes are represented in reviewed migrations;
- schema inventory and readiness contract agree;
- Worker and migration versions have a documented compatibility relationship;
- isolated restore test passes;
- no D1 migration or deployment is run without the required explicit approval;
- independent security review accepts the evidence.

**Current disposition: NO-GO.** The static audit findings are real blockers. This document is not proof that the database is ready and does not authorize writes.
