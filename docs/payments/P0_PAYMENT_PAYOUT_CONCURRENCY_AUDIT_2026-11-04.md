# PROCHÉLIA — Payment implementation audit (source-level, 2026-11-04)

**Scope:** inspect current `src/index.js` on `feature/multichannel-notifications-v1`, payment schema and request/webhook handlers.
**Status:** blocking findings; no D1 migration or live payment attempted.

## Confirmed implementation risks (not hypothetical)

### P0 — payout reserve is not atomic
`payoutRequest()` reads wallet balance, then separately subtracts available and adds reserved, then inserts payout. Two simultaneous requests can both observe the same balance and over-reserve. A crash between wallet update and payout insert can strand reserved funds. The idempotency uniqueness constraint helps replay handling but does not serialize two different idempotency keys.

**Required fix:** conditional atomic wallet update (`available_cents >= amount`) with exactly-one-change validation, payout creation and ledger effect in the same D1 transaction/batch; if a batch cannot safely express/verify all required conditions, use durable reservation state + reconciliation. Test with concurrent different idempotency keys.

### P0 — payment finalization is non-atomic and raceable
`finalizeMissionPayment()` reads status then separately updates payment and wallet. Concurrent finalizations may both credit the wallet. It also lacks a state compare-and-set predicate in the update.

**Required fix:** explicit transition matrix, conditional `UPDATE ... WHERE status IN (...)`, unique ledger effect, atomic transaction; inspect affected rows. A terminal state must not be overwritten by stale events.

### P0 — webhook payment credit is non-atomic
`paymentWebhook()` inserts event, reads transaction, updates transaction, credits wallet, and marks event processed in separate operations. The duplicate-unprocessed response is fail-closed (503), but there is no recovery lease/worker yet. A crash can leave pending event; distinct event IDs for the same transaction may also race on wallet credit.

**Required fix:** event claim/lease, event-effect uniqueness, compare-and-set payment state, ledger insertion, wallet projection and processed marker committed atomically; recover expired leases and alert on retries/dead-letter.

### P0 — payout webhook terminal state race / balance clamping
The webhook reads payout status and then separately adjusts wallet and status. Concurrent terminal events can both affect wallet. `MAX(0,reserved_cents-amount)` can conceal reservation-accounting defects rather than report them.

**Required fix:** conditional state transition first within a proven transaction; only the winner emits a unique ledger effect. Replace clamping with exact guarded accounting and reconciliation exception on mismatch.

### P1 — wallet has no durable append-only ledger in current payment schema
The current `wallets` table contains mutable counters; `payment_audit` is not a financial ledger. It is not enough to reconstruct wallet balances reliably.

**Required fix:** append-only ledger with immutable effect ID, integer cents, currency, account/side, source provider event/payment/payout, creation time, reversal linkage and reconciliation status. Corrections must be compensating entries, not edits/deletes. Restrict write paths.

### P1 — payout replay key uniqueness global scope
The idempotency key is globally unique. Existing replay guard checks user/amount/mode/currency. This is good for preventing cross-user replay, but keys should be explicitly scoped and bounded, and transaction creation needs concurrency handling for same-key simultaneous requests.

### P1 — mission payment is an internal pending record, not a PSP charge
Current handler creates a `pending` transaction and responds `PSP_CHARGE_REQUIRED`; it does not prove Stripe/PSP charge creation, customer consent, webhook authenticity in PSP-native format, capture, refund, or settlement. Never label this a completed payment integration.

### P1 — ensurePaymentSchema runs DDL from request handlers
The schema initializer executes `CREATE TABLE IF NOT EXISTS` statements during payment request handling. This is operationally undesirable and may require privileges/availability that runtime routes should not depend on. Move schema changes to reviewed, versioned migrations after explicit approval; no migration executed in this work.

## Required test suite before release

- same idempotency key, simultaneous same request → one operation, stable response;
- same key, different request/user → 409 and no effect;
- different keys, wallet balance 1000 cents, simultaneous payout requests of 700 cents → total reserved ≤ 1000 cents;
- payout reservation crash after each boundary → recover or release exactly once;
- same payment transaction with two different success events → wallet credited once;
- success and failure event race → one valid transition, no contradictory balance;
- payout paid and failed/canceled race → one terminal transition, one ledger effect;
- duplicate provider event + same payload → exactly one effect;
- provider event ID collision with changed payload/type → 409, no effect;
- event claim expires → recover once, bounded retries, dead-letter + operator alert;
- partial refund and repeated refund event → cumulative refund ≤ captured amount; ledger reversal once per refund ID;
- missing wallet, wrong currency, amount mismatch, unknown internal object → quarantine/reconciliation, not silently mark processed;
- replay, negative/unsafe amounts, precision > 2 decimals, integer overflow, currency mismatch;
- verify all conditional SQL affected-row counts against Cloudflare D1;
- test in isolated D1 and PSP sandbox, then independently reviewed preproduction.

## Status decision

**Payments and payouts are NOT production-ready.** Keep actual PSP charge/payout and user money movement disabled. The earlier idempotency checks and webhook collision/pending fail-closed protections are useful but do not close the atomicity, ledger, recovery or concurrency blockers. No merge/deploy/migration is authorized by this audit.
