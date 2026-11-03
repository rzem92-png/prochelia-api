# PROCHÉLIA — Production Readiness Gate (V14.5.7)

> Status: **BLOCKED / NOT AUTHORIZED FOR PRODUCTION** until every mandatory gate is evidenced.
> This document is a release-control checklist, not a certification or guarantee of security.

## 0. Release identity
- [ ] Record exact source commit SHA, Worker version ID, D1 database IDs, and environment.
- [ ] Confirm PR review, branch protection, required checks, and release owner approval.
- [ ] Confirm the deployment artifact is built from the reviewed SHA (no drift).

## 1. Code and CI
- [ ] CI is green on the exact release SHA (not merely on a parent commit).
- [ ] Run full unit, integration, regression, dependency, secret, SAST and license checks.
- [ ] Test API routes against real Worker runtime in isolated staging.
- [ ] Test authentication, session expiration/revocation, RBAC and tenant/client/intervenant isolation.
- [ ] Test CSRF protections with browser-origin attacks and cookie credentials.
- [ ] Test rate limits, abuse controls, input validation, upload limits and error handling.
- [ ] Validate observability does not leak credentials, payment data, or sensitive personal data.

## 2. D1 schema and migration
- [ ] Do not copy preview schema over production or drop/rename production-only tables.
- [ ] Inventory production tables, columns, indexes, constraints, triggers, and row counts.
- [ ] Produce numbered, reviewed, additive migrations with explicit preconditions/postconditions.
- [ ] Test migrations on a disposable clone of production schema and representative anonymized data.
- [ ] Verify compatibility with both old and new Worker versions (expand/contract).
- [ ] Test migration failure, retry/idempotency, and rollback/forward-fix procedure.
- [ ] Verify D1 backup export is complete, encrypted, access-restricted, and integrity-checked.
- [ ] Restore backup into a separate database and validate application-level invariants.
- [ ] Require explicit human approval before any production D1 write.

## 3. Payments (Stripe test mode only until approval)
- [ ] Confirm provider keys are test keys in staging; production secrets never appear in logs.
- [ ] Test checkout/authorization/capture/refund/dispute/payout/reconciliation flows.
- [ ] Test webhook signature verification, replay, duplicate delivery, ordering and retry.
- [ ] Test idempotency under concurrent duplicate requests and network timeouts.
- [ ] Test ledger balance invariants, refund races, chargebacks and failed payout recovery.
- [ ] Confirm no real charge or payout is possible in staging.

## 4. Privacy, legal, and operations
- [ ] Validate RGPD data inventory, purposes, legal bases, retention and deletion/anonymization.
- [ ] Validate data-subject request workflow, incident response, vendor agreements and privacy notices.
- [ ] Confirm access controls, least privilege, audit trail and secrets rotation.
- [ ] Confirm monitoring, alerting, error budgets, on-call ownership and support escalation.
- [ ] Test rollback to last known-good Worker version and compatible database state.
- [ ] Validate backup cadence, restore time objective (RTO), recovery point objective (RPO), and recovery drill.
- [ ] Review accessibility, localization, and critical client/intervenant journeys.

## 5. Canary and go-live
- [ ] Deploy to staging and run smoke/E2E tests on desktop and mobile.
- [ ] Canary release with controlled traffic and explicit stop/rollback thresholds.
- [ ] Verify health, latency, error rate, auth, booking and payment metrics.
- [ ] Human release owner signs off after observing canary.
- [ ] Production release and any D1 migration occur as separate, explicitly approved operations.
- [ ] Post-release smoke test, monitoring window, and rollback decision documented.

## Current known blockers (audit snapshot)
- Preview and production D1 schemas differ materially; direct schema replacement is prohibited.
- Production runtime integration/E2E evidence is not established by source-based tests alone.
- Stripe sandbox concurrency/refund/webhook evidence remains outstanding.
- Backup restore and recovery drill evidence remains outstanding.
- Independent security review and RGPD/legal sign-off remain outstanding.

## Release decision
**NO-GO** while any mandatory item is unchecked. A passing static test suite does not establish production readiness.
