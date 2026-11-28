# Webhook intake review — body cap, replay, atomicity and reconciliation

Date: 2026-11-28
Evidence: `src/index.js` around `verifyWebhookSignature`, `paymentWebhook`, and `requiresAtomicFinancialSettlement` on `main`.

## Observations
1. `paymentWebhook` reads the entire body via `request.text()` before verifying signature. There is no byte cap in this handler; content-length alone is not checked. An attacker can submit large bodies, and even unsigned payloads cause buffering.
2. Signature uses a custom HMAC-SHA256 header format. Before accepting production events, ensure this exactly matches the chosen provider's native signing protocol, timestamp/freshness tolerance, signed raw-byte canonicalization, provider/account binding, rotation and secret isolation. A custom header is not automatically equivalent to Stripe's native signature verification.
3. `payment_webhook_events` uses `INSERT OR IGNORE` to claim event IDs, but downstream transaction/wallet/payout mutations are separate statements, not one explicit atomic transaction. A failure after claim can cause a retry to be recognized as duplicate and return success without completing the side effects. The `processed` marker exists but duplicate handling does not appear to reconcile unprocessed rows.
4. Financial settlement event types in `requiresAtomicFinancialSettlement` are explicitly blocked with 503, which is a useful fail-closed guard; however, the set and mapping should be provider-normalized and exhaustively tested. Events not included in the blocked set may still enter non-atomic state transitions.
5. Event ID uniqueness and provider scoping must be enforced by database constraints, not just code. Verify indexes/unique constraints for provider+event ID and transaction/payout identifiers.
6. Event validation currently requires id/type/object but does not fully validate provider, account, event schema, allowed state transition, amount/currency, external identifier ownership, or timestamp before schema access and processing.

## P0 before production
- Stream-bound raw body; reject over-limit requests before buffering.
- Provider-native signature verification (signed raw bytes, timestamp tolerance, secret rotation), and provider/account binding.
- Claim + state transition + ledger/wallet changes + processed marker in a D1 atomic transaction or durable outbox state machine.
- Duplicates: return duplicate only for fully processed events; unprocessed/failed claims must resume or reconcile.
- Financial effects keyed by immutable transaction/payout identity and idempotency constraints; never rely only on event ID.
- Strict event schema, currency/amount invariants, monotonic state transitions, ownership and account checks.
- Reconciliation job and operational alerting for stale unprocessed events, mismatches and retries.
- Tests for large streamed bodies, invalid signature, stale timestamp, duplicate, concurrency, crash at each mutation boundary, retry, out-of-order events, mismatched account/amount/currency and replay.

## Scope
Review notes only; no runtime modifications, migrations, secrets, production deployment, payment activation or real data changes. Draft pending implementation and tests.
