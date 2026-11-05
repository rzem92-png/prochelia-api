# PROCHÉLIA — P0 financial atomicity implementation contract

Date: 2026-11-04
Branch: feature/multichannel-notifications-v1
Status: design and release gate only. **No migration has been executed and no financial handler is declared fixed.**

## Goal

Make payout reservation, mission payment credit, webhook effects, refund/reversal, and payout settlement exactly-once at the business-effect level, despite retries, crashes, duplicate events, or concurrency. A PSP event ID alone is not a sufficient idempotency boundary: different events may describe the same underlying payment.

## Required invariants

1. Every amount is integer minor units (EUR cents); reject floats/NaN/unsafe integers/negative values and never silently round.
2. Wallet balances are projections of an append-only ledger. No direct balance mutation outside the financial command path.
3. Every economic effect has a stable globally unique effect key, e.g. `mission-payment:<transaction-id>:credit`, `payout:<payout-id>:reserve`, `payout:<payout-id>:settle`, `refund:<refund-id>:reverse`.
4. Replays with the same effect key and identical semantic payload return the original result. Same key + different payload is a conflict and security/audit event.
5. A state transition and its ledger effect must be committed atomically, or via a documented recoverable outbox/saga with durable state. No handler may return PSP success before durable completion or a recoverable accepted state.
6. Only the transaction that wins a conditional state transition can create the corresponding ledger effect.
7. A negative available/reserved/pending balance is rejected, never clamped. A mismatch becomes a reconciliation incident.
8. No terminal state can be overwritten by a stale webhook or retry. Refunds/reversals are separate compensating effects.
9. Every PSP object is bound to merchant/account, currency, amount, transaction/payout, environment (test/live), and expected customer/provider.
10. No logs contain PAN, CVV, auth secrets, access tokens, full webhook secrets, or unnecessary personal data.

## Proposed append-only ledger (migration draft, review required)

The actual schema must be reconciled with existing D1 tables/constraints before migration. This is a conceptual contract, not executable migration approval.

- `wallet_ledger_entries`: entry_id primary key; effect_key unique; wallet_id/user_id; currency; amount_cents signed; entry_type; source_type/source_id; provider_event_id nullable; reversal_of_entry_id nullable; metadata_hash; created_at.
- `wallet_ledger_batches`: batch_id primary key; effect_key unique; command_type; source_id; status; created_at; committed_at.
- `financial_reconciliation`: reconciliation_id; source; source_id; expected_cents; actual_cents; delta_cents; status; opened_at; resolved_at; resolution_reference.
- Constraints: amount integer; currency fixed/validated; effect key unique; reversal references valid entry; ledger rows immutable at application level; no DELETE/UPDATE except tightly controlled archival process.

Use double-entry accounting if wallet funds represent a liability held for providers: debit/credit postings must balance per batch and currency. A single signed wallet entry is insufficient to represent PSP clearing, platform commission, provider payable, refund liability, and chargeback loss reliably. Finance/accountant review is mandatory before live funds.

## D1 transaction/batch implementation proof required

Do not assume a D1 batch or multi-statement request behaves as an application-level transaction without checking current Cloudflare D1 semantics and verifying the exact failure behavior.

Before touching handlers:
- inspect the exact D1 API semantics and existing indexes/constraints;
- create an isolated test schema/database with synthetic users and balances;
- prove rollback/atomicity of a batch when a later statement fails;
- prove conditional state transition and unique ledger effect in concurrent workers;
- assert changes count for every conditional update;
- simulate crashes at each persistence boundary;
- test retry after timeout where client cannot know whether operation committed;
- test concurrent requests with distinct idempotency keys and same underlying business transaction;
- retain reproducible CI evidence and database final-state assertions.

If a multi-statement operation cannot safely enforce the invariant, use a durable command/outbox state machine and reconciler. Do not use process-local locks; they do not coordinate across Workers instances.

## State machines

### Mission payment
`created -> pending_psp -> authorized -> captured/paid -> partially_refunded -> refunded`
Alternative terminal/review states: `failed`, `cancelled`, `held`, `disputed`, `chargeback`.
Transitions must be PSP-specific and validated. `paid` means confirmed capture/settlement according to provider semantics, not merely a client callback.

### Payout
`requested -> reserved -> submitted_to_psp -> paid`
Failure/reversal branches: `rejected`, `failed_retryable`, `failed_terminal`, `cancelled`, `returned`.
Reserve funds once at `requested -> reserved`; settlement releases reserved once; failure/cancel returns reserved to available once; return/chargeback creates compensating ledger entries.

### Webhook event
`received -> processing(lease) -> processed`
Retry path: `failed_retryable -> processing`; terminal path: `failed_terminal/dead_letter`.
Persist provider + event ID + type + payload hash + received time + attempt count + lease expiry. Same ID with different hash is a hard conflict and alert. Lease expiry alone does not make business effects safe; ledger effect key still protects them.

## Required tests (real D1 integration, not mocks only)

- Concurrent payout requests with balance 1000 cents, amount 700 cents, different idempotency keys: exactly one reservation; available >= 0.
- Same key concurrent same operation: one payout, same response/result.
- Same key, different amount/user/mode/currency: conflict, no additional effect.
- Two distinct PSP event IDs for same payment success: exactly one provider credit.
- Duplicate event payload and same event ID: one effect, deterministic response.
- Same event ID, changed payload or type: 409 + security audit; no effects.
- Payment success vs failure race: one valid terminal result; no contradictory ledger effects.
- Payout success vs failure/cancel race: only one transition wins; balance remains reconciled.
- Crash after event claim, after state CAS, after ledger insertion, before event processed marker: recover exactly once.
- Refund twice / partial refund concurrent: total refunded <= captured amount.
- Amount/currency/provider/merchant mismatch: reject, no effects.
- PSP timeout after submission: query/reconcile provider; never blindly create a second charge/payout.
- Chargeback and payout return: compensating entries; original ledger entries remain immutable.
- Daily reconciliation: internal ledger vs PSP balance/transactions, fee/commission and settlement; drift raises alert and blocks payout where needed.

## Security and operations gates

- Live PSP secrets are separate from test secrets; never share between preview/prod.
- Webhook signatures validated using provider-native algorithm, timestamp/replay controls, raw body, and secret rotation.
- Provider dashboard webhook retries and response policy documented.
- Payouts require provider KYC/PSP capability checks and human review/limits as applicable.
- Feature flags default OFF for real charges, refunds and payouts.
- Finance/admin actions require RBAC, step-up auth, audit, and idempotency.
- Reconciliation alerts, rollback/disable strategy, incident playbook, backup/restore, retention and access controls reviewed.
- French payment/consumer/marketplace law, PSP contract, accounting/tax treatment, commission disclosure and refund policy reviewed by qualified professionals.

## Release gate

**P0 BLOCKED.** Current source-level findings remain open until implementation and integration tests demonstrate all invariants. Passing unit tests or a successful preview build is not sufficient. No real charge, payout, refund, live webhook, D1 migration, or production release until independent security + finance review and explicit human authorization.
