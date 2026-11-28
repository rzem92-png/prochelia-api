# Payment webhook replay and processing audit — 2026-11-28

## Scope and inspected evidence
Reviewed `src/index.js` at repository commit `78e3988a4953ec9554dcaba4d3343d2d97c4a808`, `migrations/0005_payment_runtime_schema.sql`, and payment webhook tests:
- `tests/payment-webhook-security.test.js`
- `tests/payment-settlement-guard.test.js`
- `tests/payment-webhook-settlement-gate.test.js`

This is a source-tree audit, not a live PSP or deployed environment test.

## Controls observed
- HMAC-SHA256 signature verification uses the exact raw body and a constant-time string comparison.
- Missing webhook secret, missing signature, malformed signature, and altered body are rejected.
- Financial finalization event types are blocked with `503 ATOMIC_SETTLEMENT_LEDGER_REQUIRED` pending atomic settlement implementation.
- Manual mission-payment finalization is disabled and returns `PSP_VERIFIED_SETTLEMENT_REQUIRED`.
- Real charge/payout configuration is fail-closed; a provider name and secret do not alone enable money movement.
- Webhook event table has `UNIQUE(provider,event_id)` and stores a payload hash.

## Findings / residual risks
### F-01 — No signed timestamp/freshness window in webhook signature contract (MEDIUM, non-financial path only while financial events are blocked)
The signature contract signs the raw payload, but does not require a signed timestamp or enforce a maximum event age. A captured valid non-financial event can therefore be replayed. Event-ID deduplication mitigates same-provider/same-ID replays after the event is recorded, but does not provide freshness, and the provider field is selected from the payload or configured default. The handler also does not demonstrate an allowlist binding of the payload provider to the configured PSP/account. The raw webhook body is read with `request.text()` before any explicit application-level byte limit.

**Required before PSP activation:** use provider-native signature verification; require the provider's signed timestamp; enforce a short configurable tolerance; reject stale/future events; bind event identity to the configured provider/account; preserve replay protection; enforce a provider-specific raw-body size cap before parsing. Do not invent a custom provider protocol when using a real PSP.

### F-02 — Event insert and processing are not an atomic claim/complete protocol (MEDIUM, non-financial path)
For events not classified as financial-finalization, the handler inserts the event row before processing downstream state. A duplicate event ID returns `duplicate:true` regardless of the stored `processed` flag. If processing fails after insertion but before marking processed, retry may be acknowledged as duplicate and the work can remain incomplete.

**Required:** use explicit event states (received/processing/processed/failed), safe lease/claim semantics, bounded retries, and dead-letter/manual-reconciliation handling. Claim and idempotent effects must be transactional where possible; never mark an event processed before all required effects succeed. Return a retryable response when processing did not complete.

### F-03 — Financial webhook settlement remains deliberately unavailable (BLOCKER / NO-GO)
Financial events are blocked pending a transaction/payout-keyed atomic settlement ledger. This is the correct safety gate but means payment, refund, payout and dispute lifecycle is not end-to-end operational.

**Required before enabling:** PSP adapter with provider-native signature validation, event and object idempotency, atomic ledger+wallet+transaction updates, verified reconciliation, refund/dispute/payout workflows, sandbox E2E, failure/replay/concurrency tests, operational alerts, and explicit legal/PSP review.

## Release decision
**NO-GO for production payment activation.** These findings are documentation/evidence only. No secrets, production data, remote D1, PSP, deployment, or financial state were touched.
