# Runtime D1 schema initialization audit (branch snapshot)

**Snapshot audited:** `fix/nexus-minimum-viable-quote-gate` at `ac1ff901fd1f9b1e6f1c5958ddef7ebc9b323728`  
**Scope:** static inspection of `src/index.js`; no D1 access or migration execution.  
**Status:** BLOCKING for production readiness until migration ownership and rollout are verified.

## Finding

The Worker contains ten `ensure*Schema` helpers that issue DDL (CREATE TABLE/INDEX/TRIGGER) from request paths. This creates schema-change work in the runtime request lifecycle and makes deployment state dependent on traffic and permissions. Do not simply remove these calls: that may break routes on databases that have not received the corresponding schema.

## Helper inventory (source line numbers at audited snapshot)

| Helper | Source line | DDL family |
|---|---:|---|
| `ensureSecuritySchema` | 447 | Identity verification, trusted devices and security tables |
| `ensurePaymentSchema` | 789 | Payment tables |
| `ensureConsolidatedSchema` | 1375 | Platform settings, profiles, pricing, cases, ledger, accounting, outbox, compliance |
| `ensureStrategicSchema` | 2140 | Strategic/SUPRA storage |
| `ensureOperationalSchema` | 2518 | Operational storage |
| `ensureFinalHardeningSchema` | 2829 | Final hardening storage |
| `ensureCommercialRecruitmentSchema` | 2987 | Commercial/recruitment storage |
| `ensureFinanceWorkspaceSchema` | 3148 | Finance workspace storage |
| `ensureNationalContinuitySchema` | 3495 | Continuity storage |
| `ensureProcheliaMasterComplementSchema` | 3658 | Master/complement storage |

## Required migration hardening before removing runtime DDL

1. Establish a canonical migration ledger (version, checksum, applied timestamp, environment).
2. Extract each DDL statement into ordered, reviewed SQL migrations; preserve defaults, indexes, triggers, constraints, and data transformations.
3. Confirm migration idempotency and explicitly handle non-idempotent operations; avoid relying on `CREATE IF NOT EXISTS` to conceal drift.
4. Run migrations only against a pinned Preview D1 with a verified encrypted backup and restore drill.
5. Compare pre/post schema using SQLite/D1 metadata and test every affected route.
6. Add tests proving normal Worker requests do not execute DDL and missing schema produces a safe, diagnosable failure.
7. Deploy schema before compatible code; support rollback/forward-fix and compatibility windows.
8. Require a separate human approval for any production migration or deployment.

## Acceptance gates

- [ ] DDL inventory includes every helper and all call sites.
- [ ] Existing Preview schema and data are backed up and restore verified.
- [ ] Migration files have review, checksum, and deterministic ordering.
- [ ] Preview migration applied only to the pinned Preview D1.
- [ ] API, auth/RBAC, payments, ledger, and operational regression tests pass after migration.
- [ ] Runtime DDL absent from request paths, verified by tests.
- [ ] Production schema diff reviewed and production approval explicitly recorded.

## Explicit safety boundary

This audit does **not** apply a migration, remove runtime schema calls, touch production, or certify security. Production remains blocked until the gates above are satisfied.
