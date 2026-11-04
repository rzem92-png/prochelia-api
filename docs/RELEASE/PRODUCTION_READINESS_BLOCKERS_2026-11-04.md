# PROCHÉLIA — Security/Payments review notes (feature branch)

Date: 2026-11-04
Status: development/preproduction only. This is not production approval.

## Current branch work
- Atomic rate-limit counter: D1 UPSERT + RETURNING; fails closed if the counter result is invalid.
- Payment webhook event replay: same provider/event ID with same payload hash is acknowledged only if already processed; an unprocessed duplicate now fails closed with HTTP 503 / Retry-After (recovery worker still missing).
- Conflicting payload hash or event type for the same event ID: rejected with HTTP 409 and audit event.
- CI workflow includes src/index.js syntax check when backend entrypoint changes.

## Explicit unresolved high-risk items
1. Payment webhook lifecycle: initial receipt insert and downstream financial effects are not yet crash-safe as a single recoverable workflow.
2. Wallet credits/payout settlement: status changes and balance movements need atomic, conditional transitions plus an immutable ledger with unique effect keys.
3. Rate-limit: atomic UPSERT has not yet been verified under concurrent D1 integration load; D1 unique-key and RETURNING behavior needs environment test.
4. Mission code delivery/redeem: D1 concurrency, delivery crash, expiry, replay and lockout tests remain.
5. Authentication: review session revocation, CSRF, OTP throttling/cooldown and inactive-account enforcement.
6. Payment reconciliation: compare provider records to internal transaction/wallet ledger and handle mismatch queues.
7. Production readiness: legal/RGPD review, restore test, monitoring/alerting, rollback and end-to-end user journeys remain.

## CI and preview deployment evidence — 2026-11-04 (latest)

- GitHub Actions workflow run **41916221208** is completed successfully for current PR head `4d6adf5c0e3fee1c4e7419693d18647c039837d6`. Steps passed: module syntax checks, mocked provider tests, webhook HMAC tests, mission-code tests, payment-idempotency tests, and guard confirming no live provider sends.
- This is unit/CI evidence only. It does not establish Cloudflare D1 concurrency/crash safety, PSP sandbox, E2E, penetration/security review, legal/RGPD review or production readiness.
- Cloudflare preview builds for earlier commits failed because Wrangler preview lacked a `previews` D1 binding.
- Corrected `wrangler.jsonc` on the feature branch: normal Worker binding remains `prochelia-db` (`04f52830-ef5a-4f17-a640-42bbc2381bba`); preview-only binding now targets the separate database `prochelia-preview-db` (`6adb95e5-e542-4bec-9008-fbea01042305`). Metadata and schema inspection confirmed this preview database exists; no SQL writes or migrations were executed.
- Cloudflare build **d8667b8d-b1ed-495e-a06c-803ef630b5ec** succeeded for commit `4d6adf5c0e3fee1c4e7419693d18647c039837d6`. Preview URL: https://feature-multichannel-notifications-v1-prochelia-api.rzem92.workers.dev . Unique build URL: https://9f451448-prochelia-api.rzem92.workers.dev .
- Wrangler 4.157.0 warns that `wrangler preview` is open beta. Treat this as a successful preview deployment build, not as validation of API health or application flows. Health endpoint was not verified through an independent runtime probe in this check.
- Preview uses a separate D1 binding, but the database still requires review for test data hygiene, privacy, and no real customer data. Do not load production data into preview.


## Do not
- merge the draft PR;
- run production D1 migrations;
- deploy production;
- enable live PSP, real payouts or provider messaging;
- declare zero defects or production-ready without CI and integration evidence.

## Suggested gate order
A. Static syntax/unit tests → B. CI green → C. isolated D1 concurrency/crash tests → D. PSP sandbox end-to-end → E. security/privacy review → F. human production approval.

## Source-level audit addendum (2026-11-04, payment paths)

The focused handler review confirmed the following additional P0 findings:
- payout request balance read, reservation update and payout insert are separate operations; concurrent distinct idempotency keys can overspend/reserve and crashes can strand funds;
- manual payment finalization updates transaction and wallet in separate operations and can race;
- payment webhook can credit a wallet after a non-atomic status read/update; event uniqueness does not prevent distinct provider events from racing on one transaction;
- payout webhook terminal transitions and wallet updates race; MAX(0,reserved-amount) hides accounting discrepancies;
- wallet schema currently uses mutable counters without a durable append-only financial ledger;
- payment schema creation runs DDL from request paths;
- payment creation currently returns PSP_CHARGE_REQUIRED; it does not prove real PSP charge/capture/refund/settlement integration.

Detailed evidence and required test cases: docs/payments/P0_PAYMENT_PAYOUT_CONCURRENCY_AUDIT_2026-11-04.md.
Architecture/test contract: docs/payments/WALLET_LEDGER_ATOMICITY_DESIGN.md.

**No real-money feature should be activated until these P0s are fixed and proven with Cloudflare D1 concurrency/crash tests and PSP sandbox reconciliation.**

## Addendum — continuation checkpoint (2026-11-04)

- Security regression contract added: `docs/security/AUTH_SECURITY_REGRESSION_MATRIX_2026-11-04.md` (commit `7e9f2d32564479e68352f86ad1becc4752efcf56`). It defines origin/CSRF, bootstrap race, session revocation, RBAC and zero-side-effect denial tests. **These tests are a contract; they have not yet been executed against isolated D1/browser runtime.**
- Financial atomicity contract added: `docs/payments/P0_FINANCIAL_ATOMICITY_IMPLEMENTATION_CONTRACT_2026-11-04.md` (commit `f72014fd1d180914530c90edc89497e09bb5ff10`). It covers ledger effect uniqueness, D1 batch/rollback proof, state machines, PSP reconciliation and required concurrent/crash tests. **No payment implementation or migration was changed by this document.**
- CI run **41916952481** completed successfully for commit `7e9f2d32564479e68352f86ad1becc4752efcf56`. This validates the existing configured workflow only; it does not execute the newly documented D1/CSRF/concurrency test matrix.
- Cloudflare build **7b989ee7-07c0-44f4-9be4-4d74aa236911** succeeded for `7e9f2d...` (documentation-only branch commit).
- Cloudflare build **92969e8e-bf95-442d-b56d-be6894ba6006** for `f72014...` was still queued at the last check.
- Draft PR #88 remains unmerged. No production Worker, production D1, live PSP, live payout or real notifications were touched.

**Next engineering gate:** implementation—not further documentation alone—of isolated D1 atomic financial effects and auth/CSRF/bootstrap race tests, with test evidence and failure injection. Keep release status **BLOCKED** until the results are green.
