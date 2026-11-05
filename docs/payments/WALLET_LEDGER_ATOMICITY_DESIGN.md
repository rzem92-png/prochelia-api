# PROCHÉLIA — Wallet ledger & webhook atomicity design

**Status:** architecture/test contract for isolated preproduction. Not a migration, not a production approval.
**Branch:** `feature/multichannel-notifications-v1`

## Why this gate exists

The current payment implementation still performs several financial writes as separate D1 calls. A successful webhook can therefore leave partial state if execution stops between statements. Concurrent distinct provider events may also race on the same payment/payout. Do not enable real money until the invariants below are enforced by durable SQL constraints and tested against the actual D1 runtime.

## Non-negotiable invariants

1. **Append-only ledger:** every wallet movement is a ledger row; never use the mutable wallet balance as the only source of truth.
2. **Unique financial effect:** each logical effect has a unique immutable key, for example `provider:event_id:effect_type`. A duplicate event/effect must not create another movement.
3. **Atomic state + effect:** payment/payout state transition, ledger insertion, wallet projection update, and webhook processed state must commit together, or none of them commits.
4. **Compare-and-set:** state changes include the expected prior state in the SQL predicate. A stale event cannot overwrite a terminal state.
5. **No negative funds:** payout reservation is a conditional update (`available_cents >= amount`) and must verify exactly one row changed.
6. **No silent clamping:** avoid `MAX(0, reserved_cents - amount)` as a way to hide inconsistent payout accounting; discrepancy goes to an exception queue.
7. **Currency and integer cents:** EUR amounts are integer cents; reject unsafe integers, unsupported currency, invalid sign and mismatched totals.
8. **Reconciliation:** ledger-derived balances must reconcile with wallet projections and PSP reports. Any mismatch is visible, queued and never auto-erased.
9. **Audit metadata only:** no secrets, OTP, full payment credentials, or unnecessary personal data in logs.
10. **Human-controlled production activation:** sandbox validation and release approval remain separate from code completion.

## Suggested durable event lifecycle

`received → processing (lease/token + attempt) → processed`

Recoverable failures: `retryable` with next-attempt time and bounded backoff.
Permanent/ambiguous failures: `dead_letter` / manual finance review.
Expired lease: reclaim only with compare-and-set on the old lease token/expiry.
A webhook must not be acknowledged as processed until its durable financial effect is committed. If provider retries are expected, return a retryable response only when a bounded recovery path exists; alert on repeated pending events.

## D1 transaction strategy to prove in preproduction

Use D1 `batch()` only after confirming its transaction semantics for this exact Worker/runtime. A batch must include all related SQL effects:
- claim or transition the event with a compare-and-set predicate;
- insert the ledger effect under a unique effect key;
- update wallet projection only for the newly inserted/unapplied ledger effect;
- update payment/payout status using expected prior status;
- mark the webhook processed;
- insert audit/reconciliation metadata.

The application must inspect each result's `meta.changes`; any unexpected count is a conflict/failure, not success. Do not rely on a pre-batch SELECT to make a race-safe decision. For logic that cannot be expressed atomically, use a durable queue/lease and reconciliation rather than pretending it is transactional.

## Test matrix (isolated D1; no real PSP)

### Duplicate/replay/concurrency
- 100 parallel deliveries of the same event ID and payload → one effect key, one credit/debit, one terminal transition.
- Different event IDs representing the same payment → still one payment credit.
- Same event ID with different payload hash/type → 409 + security anomaly, no money movement.
- Concurrent payout requests against the same wallet → accepted requests never exceed available balance; rejected requests have no reservation.
- payout success/failure/cancel in parallel → exactly one terminal outcome and exactly one matching ledger effect.
- payment success vs failure/refund in parallel → no invalid final-state overwrite; explicit refund ledger effect.

### Crash injection
Inject failure before and after each statement boundary: event claim, ledger insert, wallet projection, transaction/payout status, processed flag. After retry/recovery, invariant must hold and effect count remain exactly one.

### Consistency and operations
- Recompute wallet projection from ledger and compare available/pending/reserved/paid.
- PSP reconciliation: matched, unmatched, amount mismatch, currency mismatch, missing internal record, duplicate provider record.
- Expired lease recovery, retry exhaustion, dead-letter review and alert.
- Verify D1 constraints and `RETURNING`/changes metadata in Cloudflare Worker—not only SQLite local tests.
- Confirm backups, restore and audit trail before enabling finance operations.

## Release decision

This design document does **not** mean the current handler satisfies these guarantees. Keep payments in sandbox/mock mode until implementation, D1 concurrency/crash tests, reconciliation, legal/PSP review and explicit production approval are complete.
