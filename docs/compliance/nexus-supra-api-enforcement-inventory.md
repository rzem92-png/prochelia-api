# Nexus Supra — API enforcement integration inventory (Preview)

**Status:** inventory only; no runtime changes, no launch authorization.  
**Scope inspected:** `src/index.js` and `src/v7-routes.js` at the Preview branch.  
**Date:** 2026-11-27.

## Observed fail-closed controls

| Route / operation | Observed control | Status / gap |
|---|---|---|
| `POST /api/missions` | Always returns 503; write_enabled=false | Safe closed; implementation intentionally disabled |
| `POST /api/missions/validate` | Returns 403 AUTHENTICATED_VALIDATION_REQUIRED | Safe closed; ownership binding intentionally disabled |
| Security identity / mission preparation / presence / code verification | Dedicated security handlers | Separate actor/ownership/state, rate-limit, one-time and expiry review needed |
| Payment webhook | Signature required; financial settlement event types rejected until atomic ledger | Safe closed for financial state transitions; PSP integration remains blocked |
| Payment dispute | Auth role; client ownership checked; conditional batch state change | Requires concurrency, transaction semantics, idempotency and reconciliation tests |
| Payment admin resolution | Manager role; PSP settlement required; writes disabled | Safe closed |
| Clients/intervenants directory | Authenticated manager only; bounded pagination | Verify field minimization, authorization and tenant isolation tests |
| Bootstrap | Secret token + atomic first-manager creation | Validate secret rotation, abuse throttling and deployment config |
| Login/logout | Password verification/session creation; logout deletes session hash | Audit throttling, session fixation, cookie flags, CSRF and credential-stuffing controls |
| V7 check validators | Pure validation endpoints; permissions endpoint requires authenticated manager | No mutation identified in inspected validator paths; public validators may disclose oracle details; review minimization/rate limits |

## Binding requirement before enabling mutations

A real server-side integration must derive actor and tenant from authenticated session/database records, never client claims. Bind a fresh expiring decision to exact operation, resource, actor, tenant, market profile, jurisdiction, activity, policy version and context fingerprint. Re-check authorization and ownership in the same transactional boundary as the write; enforce single-use/idempotency and concurrency; audit safely; test rollback/compensation and replay.

The new binding preflight (#443) is **advisory only**. It cannot substitute for D1 transaction logic, authenticated route middleware, or an atomic single-use ledger.

## Journey integration sequence (Preview, no production writes)

1. Mission/booking creation and assignment: actor, client, provider, prestation, ownership, status transition, availability, quote/price/fees, jurisdiction/activity.
2. Provider onboarding and offer publication: identity/qualification/insurance/eligibility, trader traceability, disclosures, ranking and paid-placement transparency.
3. Payment, wallet, payout, refund and disputes: PSP sandbox, ledger reconciliation, idempotency, atomic reserve/release, webhooks, consumer remedies.
4. Cancellation, withdrawal, completion, invoice, reviews and complaints: contract rules, exceptions, evidence and deadlines.
5. Data access/export/delete and retention: verified requester, scope, legal holds, minimization, logging without payload/PII.
6. Market launch gate: jurisdiction/activity/role-specific current source register, controls, independent qualified legal review, operational evidence, approval and expiry.

## Regulatory baseline register (source-dated, jurisdiction-scoped and reviewed)

- France/EU consumer transparency, marketplace/intermediation status, ranking, sponsored placement, trader information, pre-contract information, price/fees, cancellation/withdrawal and complaint handling.
- DGCCRF consumer protection and unfair commercial practices; platform obligations depend on PROCHÉLIA's actual role and model.
- GDPR/CNIL: lawful bases, controller/processor roles, data minimization, retention, rights, security, DPIA where required, processor agreements and breach handling.
- DSA: applicability, trader traceability, notice/action, transparency and complaint obligations based on service classification, size and exemptions.
- DAC7/DPI tax reporting applicability and provider reporting workflows.
- Payment services rules and PSP contractual/legal requirements: no holding/transmitting funds or presenting payouts as available until role, adapter, reconciliation and authorization are validated.
- Local rules: activity-specific qualifications, insurance, consumer, employment, tax, accessibility, safety and permits; country/region and city rules where applicable.
- International launch: conflict of laws, consumer protection, tax, privacy transfers, sanctions/export restrictions, localization, language, currency, dispute resolution and local legal review.

## Required acceptance evidence

- Automated route inventory and mutation classification, owners and risk tiers.
- Tests: unauthenticated, wrong role, cross-tenant/resource ID substitution, stale/expired/mismatched gate, replay, duplicate requests, concurrency/races, rate limits, CSRF, webhook replay/signature, data minimization and recovery.
- Security review and threat model; reproducible CI; sandbox E2E evidence; migration backup/restore evidence.
- Each control has source/version, jurisdiction/activity/role, reviewer, review date, expiry, evidence, implementation link and PASS/FAIL/UNKNOWN/N/A/exception.
- Unknown/expired mandatory controls block. Exceptions narrow, time-bound and human-approved.
- Nexus Supra may recommend deterministic reversible remediation in Preview; it must not autonomously grant legal approval, move money, sanction/terminate users, delete/export personal data, change production, or launch a market.

## Newly detected high-risk issue and Preview correction

During deeper source inspection, the operational Copilot accepted caller-provided mission/context fields and could auto-resolve certain low-impact cases. Its business-action handler contained direct mission reassignment and reschedule writes. That path did not demonstrate complete resource ownership, availability, operation binding, idempotency, and transaction checks before mutation.

**Corrective change now in this draft:** autonomous case execution is disabled; cases remain pending human review. The automatic execution function fails closed. Mission reassignment/rescheduling are queued rather than directly written, and queued provider actions remain non-executable pending an adapter with server-side revalidation. Regression tests and CI were added.


Additional correction: case approvals now preserve `WAITING_PROVIDER` when actions are queued and do not mark the case resolved prematurely. Regression coverage checks this state.

This is a source-level safety improvement, not a proof that every route is safe. Human approval also must not be interpreted as permission to bypass ownership/state/transaction controls. The next required work is a server-side route integration and adversarial testing of case creation/approval, including cross-tenant IDs and malicious context.


### Ownership/scope hardening added

Operational case creation now derives client/provider profile IDs from the authenticated user, verifies mission ownership/assignment against D1, rejects caller-supplied mismatched IDs, and fails closed for company case scope until the company-to-mission relation is proven. Every case is forced to human review; caller context cannot request automatic business execution. Regression tests cover these guards.


### Outbox execution guard

The outbox processor now fails closed for every queued action because no verified executor is registered: it marks items `WAITING_PROVIDER` and does not mark queue acknowledgement as successful business completion. The regression test verifies this guard.

## Conclusion

This inventory identifies next integration targets but does **not** certify compliance, security, production readiness or legal adequacy. Mission and settlement gates remain closed. No merge, migration, deployment, real payment or market launch is authorized by this document.
