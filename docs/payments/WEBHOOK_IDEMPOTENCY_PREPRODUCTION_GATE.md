# Payment webhook hardening — preproduction gate

**Status: partial hardening only; not production approved.**

## Implemented in feature branch
- Rate-limit counter uses atomic D1 UPSERT with RETURNING.
- Webhook event ID replay now compares the stored payload hash and event type.
- A duplicate event ID with a different signed payload is rejected with HTTP 409 and a security audit entry instead of being silently acknowledged.

## Still blocking production
The event receipt and downstream financial effects are not yet committed as one proven atomic operation. A crash after the event insert can still leave a received event unprocessed while retries are treated as duplicates. Wallet credits and payout balance changes also need atomic state transitions and a durable idempotent ledger.

Do not enable real-money processing until these are implemented and tested against D1:
1. event lifecycle: received → processing (lease) → processed / retryable failure / terminal failure;
2. replay-safe financial ledger with unique effect key (provider + event ID + effect type);
3. conditional state transition and wallet effect in a transaction/batch whose behavior is verified;
4. retry/recovery worker for expired processing leases;
5. concurrent duplicate delivery, crash-after-receipt, crash-after-effect, and payout/payment race tests;
6. payload mismatch anomaly alert and reconciliation.

## Required sandbox scenarios
- valid webhook, invalid signature, malformed JSON;
- same event ID + identical payload (idempotent 200);
- same event ID + different payload (409 collision);
- two concurrent copies of same event;
- event received then handler crash;
- payment success repeated and racing with failure/refund;
- payout success repeated and racing with failure/cancel;
- wallet ledger totals reconcile to balances;
- unknown transaction/payout and unsupported event types;
- retry/backoff and dead-letter/manual review.

No live PSP call, migration, merge, or production deployment is performed by this gate.
