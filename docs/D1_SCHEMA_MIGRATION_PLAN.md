# PROCHÉLIA — D1 schema migration and readiness plan

**Status:** investigation and execution plan only. No SQL migration has been applied by this document.  
**Target:** isolated preproduction D1 first. Production remains out of scope without explicit owner approval.

## 1. Verified code findings

At the audited prelaunch code:
- Worker source is `src/index.js`.
- Worker version constant is `V14.5.7-EXPERT-PREPRODUCTION`.
- `migrations/0005_security_rate_limits.sql` identifies itself as V14.5.8 and creates `security_rate_limits`.
- The release audit detects 83 call sites matching `await ensure*Schema(env)`, across 13 distinct schema initializer functions.
- The current `/api/readiness` check does not verify the full set of module dependencies required by the release audit.
- `wrangler.jsonc` points at the preview database `prochelia-preview-db` (ID `6adb95e5-e542-4bec-9008-fbea01042305`) and a preview R2 bucket. This is configuration evidence only; it is not evidence of the live D1 schema or a successful backup/restore.

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
