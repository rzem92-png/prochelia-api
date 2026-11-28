# V7 financial validator review — Preview

## Scope and current code observations
Review of `src/v7.js` identifies three important limitations in the V7 validation/calculation helpers:

1. `v7CheckPricing` converts `amount`, `minimum`, and `maximum` using `Number` but does not reject invalid/NaN bounds, negative amount, or inconsistent minimum/maximum. Malformed bounds can make comparisons ineffective.
2. `v7CalculateFinance` coerces invalid inputs to zero using `Number(value) || 0`, accepts negative amount/fees and commission rates outside 0–100, and returns floating-point values without explicit currency rounding.
3. `v7CheckPayment` trusts a caller-provided status string. A positive result is not proof of payment; only authenticated PSP webhooks/API reconciliation and the authoritative ledger can establish settlement.

## Risk
These helpers are validation/calculation only. They must not be used as the authoritative pricing, accounting, settlement, payout, refund, or payment authorization layer. Inaccurate amounts can affect consumer transparency, provider remuneration, commission disclosure, reconciliation and disputes.

## Required remediation
- Reject non-finite amount and bounds; require amount >= 0; minimum >= 0; maximum >= minimum when provided.
- Define currency and rounding policy explicitly (integer minor units or a documented decimal arithmetic strategy); round each payable component consistently.
- Validate finance inputs: client amount >= 0; commission rate within configured policy bounds; fees >= 0; currency present/known when calculation becomes multi-currency; reject malformed values rather than silently replacing with zero.
- Use a server-owned pricing policy version and preserve the breakdown: gross customer price, mandatory fees, optional fees, provider net, platform commission, PSP fees, taxes where applicable, total, currency, and rounding.
- Payment status helper must be clearly marked advisory; never accept request-body status as settlement evidence.
- Reconcile authoritative PSP event/API data with an immutable, idempotent ledger before money-state transitions.
- Add regression tests for NaN, Infinity, negative values, >100% commission, malformed bounds, min>max, rounding boundaries, currencies, and forged payment statuses.
- Have legal/finance review fee presentation and consumer disclosures (DGCCRF/consumer law) before launch.

## Status
Finding recorded only. No implementation or test result claimed. Preview only. No production financial actions.
