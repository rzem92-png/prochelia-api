# PROCHÉLIA — Hardening release gates (Preview only)

## Scope and safety
This branch is isolated from `main`, production Worker and production D1.
No deployment, D1 migration, bootstrap, payment, payout, mission write, or production configuration change is authorized by this document.
The Preview API currently reports D1 connected, readiness true, mission writes disabled, and bootstrap required. The read-only schema audit reports zero rows in users, clients, intervenants, sessions and disponibilites. These observations do not prove that the runtime D1 binding UUID matches the intended Preview UUID; that must be attested independently.

## Release blockers confirmed by source inspection

### B1 — Runtime DDL in request path
`handleConsolidated` invokes `ensureConsolidatedSchema(env)` before route-specific handlers. That helper performs CREATE TABLE, CREATE INDEX, CREATE TRIGGER and INSERT OR IGNORE defaults. Other schema helpers are also invoked from request handlers. This makes schema provisioning a runtime side effect and couples request availability to schema mutation.
**Required remediation:** inventory every schema helper and every caller; create ordered, reviewed, checksummed D1 migrations; move defaults to explicit seed migrations; remove DDL/DML schema provisioning from ordinary requests; test missing-schema behavior is fail-closed and does not mutate D1. No migration is to be applied until Preview target identity, encrypted backup, restore drill and migration review are confirmed.

### B2 — Multiple service catalogues
The legacy `/api/prestations` reads `prestations`; the newer `/api/metiers` and pricing quote flow read `métier_catalog`. No proven mapping or canonical ownership contract was found in this audit.
**Required remediation:** define one canonical server-side catalogue and a migration/mapping strategy; preserve stable service codes; reconcile active/inactive state, pricing rules and references; make legacy endpoints read from the canonical source or retire them with a versioned compatibility plan. Never silently copy or merge catalogue rows.

### B3 — Finance quote semantics are not proven
`financeStrategicQuote` computes a percentage commission, accepts an independent intervenant floor/payout amount, and computes estimated margin as service revenue minus intervenant amount, PSP fee and software cost (travel charge/cost netted out). It returns the percentage commission separately. This may be internally consistent only under a documented contract where the provider payout and platform commission are reconciled; the current inputs do not enforce that relationship. The quote's margin and commission therefore cannot yet be certified as one accounting formula.
**Required remediation:** approve a single signed-off model for B2C and B2B, including gross client price, travel charged vs actual travel cost, discounts, platform fixed/variable commission, provider payout/floor, PSP fees, refunds/chargebacks, tax/VAT treatment and allocated operating costs. Then implement one pure integer-cent calculation used by quote, payment, ledger, refund and finance summary. Add property tests for conservation of funds, caps/floors, rounding, negative/overflow values, zero/maximum commission, travel included/excluded, and infeasible margin. Do not invent commercial terms in code.

### B4 — SUPRA execution boundary
The current planner explicitly reports `executionAllowed:false` / `executionAdapterReady:false`. This is appropriate. No domain may be labelled autonomous until its adapter has server-side authorization, idempotency, verified receipts, audit journal, retries/compensation and independent tests.
**Required remediation:** capability-by-capability maturity gates; human approval for payments, payouts, refunds, contracts, account suspension, deletion, legal/RGPD decisions and production releases.

### B5 — Migration workflow/environment mismatch
The manual D1 migration workflow checks out `prelaunch/v14.5.7-consolidation-audit` and targets Worker `prochelia-api-staging`, while the dedicated preview Worker configuration names `prochelia-api-preview`. These are distinct deployment identities. The referenced migration files were not found at the expected paths on the audited feature branch.
**Required remediation:** create a single authoritative environment matrix (branch, Worker, Pages preview, D1 UUID, account ID, secrets scope, migration directory); make workflow target checks compare all values; prohibit migration if any identity is missing or mismatched. Do not run the existing migration workflow until reconciled.

## Required automated test suites before Preview writes
1. Static/source guard: no runtime DDL/seed writes in request handlers; all schema changes are numbered migrations.
2. Authentication/RBAC: anonymous, expired, revoked, wrong-role, cross-tenant and object-ownership cases.
3. Session security: cookie flags, rotation, logout invalidation, fixation/replay, CSRF/origin and CORS.
4. Concurrency/idempotency: duplicate submit, concurrent approve, timeout/retry, PSP webhook replay and out-of-order delivery.
5. Finance invariants: every cent allocated exactly once; debit equals credit; payout/refund/commission reconciliation; cap/floor and rounding properties.
6. Catalog integrity: unique stable service code, one active canonical tariff, no orphan pricing policies or quote references.
7. SUPRA safety: prompt injection, untrusted client context, missing/stale evidence, permission escalation, approval hash/version/expiry/amount binding.
8. Data lifecycle: encrypted backup, tested restore into isolated D1, retention/deletion/anonymization and audit evidence.
9. E2E: Client, Intervenant and Gérante journeys in Preview, Safari iOS, Android and desktop; sandbox PSP only.
10. Operational: rate limits, alerting, log redaction, error budgets, dependency and secret scanning, rollback/compensation drill.

## Release gates
- G0 source and dependency audit complete.
- G1 deterministic unit/invariant tests pass.
- G2 isolated D1 migrations reviewed and applied only after backup/restore proof.
- G3 API integration/RBAC/security tests pass.
- G4 browser E2E and accessibility/mobile acceptance pass.
- G5 PSP sandbox and accounting reconciliation pass.
- G6 independent security, privacy and legal review accepted.
- G7 owner gives explicit production release approval.

No gate implies the next gate automatically. A green health/readiness endpoint is not production approval. Real traffic remains disabled until G7.
