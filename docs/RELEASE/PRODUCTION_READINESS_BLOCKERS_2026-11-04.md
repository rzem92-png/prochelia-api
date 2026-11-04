# PROCHÉLIA — Security/Payments review notes (feature branch)

Date: 2026-11-04
Status: development/preproduction only. This is not production approval.

## Current branch work
- Atomic rate-limit counter: D1 UPSERT + RETURNING; fails closed if the counter result is invalid.
- Payment webhook event replay: same provider/event ID with same payload hash is acknowledged as duplicate.
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

## Do not
- merge the draft PR;
- run production D1 migrations;
- deploy production;
- enable live PSP, real payouts or provider messaging;
- declare zero defects or production-ready without CI and integration evidence.

## Suggested gate order
A. Static syntax/unit tests → B. CI green → C. isolated D1 concurrency/crash tests → D. PSP sandbox end-to-end → E. security/privacy review → F. human production approval.
