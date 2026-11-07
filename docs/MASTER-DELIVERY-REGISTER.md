# PROCHÉLIA — master delivery register (preproduction)

**Revision:** 2026-11-07  
**Branch:** `preprod/r2-eu-binding-isolated-2026-11-07`  
**Status:** planning/traceability artifact — NOT a release approval.

This register consolidates the product scope and outstanding launch evidence. A feature is not “done” merely because a route, mock, UI, or checklist exists. Mark **PASS** only with repeatable test evidence on the intended environment.

## 1. Product surfaces and user journeys

| Area | Required acceptance evidence | Current release state |
|---|---|---|
| Client onboarding | signup/login/recovery/OTP where configured, consent, privacy notice, account deletion/export | BLOCKED: live browser journey not evidenced |
| Client booking | service catalogue, address, date/time, quote, confirmation, cancel/reschedule, no-show and dispute flow | BLOCKED: full journey not evidenced |
| Intervenant | registration, identity/document verification, skills, availability, first-name-only public profile, accept/decline, mission check-in/out | BLOCKED: identity provider and complete journey not evidenced |
| Manager/admin | RBAC, least privilege, audit trail, moderation, dispute handling, pricing controls, reconciliation | BLOCKED: role-by-role acceptance not evidenced |
| Contracting | client/provider terms and mission-specific contract, signature/evidence, platform intermediary disclosures | BLOCKED: legal review and signing evidence required |
| Support/notifications | email/SMS delivery, retries, template localization, suppression/consent, incident escalation | BLOCKED: provider and delivery tests not evidenced |
| Responsive/PWA | iOS Safari, Android Chrome, tablet/desktop, accessibility, offline/error behavior | BLOCKED: device/browser matrix not recorded |

## 2. Core business logic

- Catalogue and service taxonomy (accompaniment, errands, household chores, surveillance/assistance) with boundaries for regulated care and medical services.
- Availability, distance/zone, travel time and mission duration; avoid continuous GPS outside an active mission.
- Pricing must be server-authoritative: base price, duration, travel/mileage, evening/weekend/holiday surcharges, platform commission, provider earnings, taxes/fees, currency, rounding and cancellation rules.
- Nexus matching: explainable matching factors (availability, location, verified skills, quality, price); fairness/anti-discrimination review, no sensitive-attribute inference, no opaque automatic adverse decisions, human appeal.
- Copilote: assist with planning, operations, document drafting and support. Require human confirmation for legal, contractual, financial, identity, eligibility, sanctions, refunds/payouts and production actions.
- Referral: attribution, abuse prevention, eligibility, reward caps, accounting and consent.
- B2B: separate organization/tenant model, permissions, invoicing and data isolation before enabling.

**Acceptance:** golden test vectors for pricing and commission; deterministic state-transition tests; concurrent booking/availability tests; idempotency/replay tests; audit trace for every sensitive decision.

## 3. Security, privacy and architecture

- API: inventory route/method/auth/RBAC/ownership; deny-by-default; schema validation; limits; rate limiting; idempotency; safe error handling.
- Session: Secure/HttpOnly/SameSite, expiry/rotation/logout, CSRF protection for state changes, exact CORS allowlist; browser acceptance in Safari and Chromium.
- Storage: R2 private bucket, least privilege, isolated staging; no public access or production data in preproduction.
- D1: migrations reviewed offline, tested against disposable DB, backups verified before irreversible changes; no production migration without explicit approval.
- Identity: minimize document retention, encrypt at rest/in transit, access audit, retention/deletion, provider and processor agreements.
- GDPR: data map, lawful bases, notices, rights request process, retention schedule, anonymization/deletion, processor contracts, transfer assessment, breach playbook and DPIA screening.
- Secrets: no credentials in source, logs, GitHub artifacts or chat; rotate any exposed preproduction credentials.
- Security testing: dependency/SCA, secret scan, static analysis, abuse cases, tenant-isolation and authorization tests.

## 4. Payments and finance (sandbox only)

- Stripe Connect onboarding/KYC status, sandbox payment intent lifecycle, failure/cancel/refund/partial refund, duplicate webhook/replay, dispute/chargeback, concurrent refunds, payout and reconciliation.
- Validate commission, fees, tax, rounding, currency and ledger invariants.
- Never store card data; use Stripe-hosted/tokenized components.
- Sandbox/live keys and endpoints must be segregated.
- No live charge, payout, refund or Stripe live mode until explicit production authorization and finance/legal approval.

## 5. Resilience and operations

- R2 synthetic lifecycle PUT → GET/checksum → DELETE → 404, old-token rejection after rotation; record evidence.
- Backup scope, encryption, retention, RPO/RTO; restore drill to isolated environment with integrity check.
- Observability: redacted structured logs, metrics, alerting, webhook backlog, storage, API errors and auth anomalies.
- Load/burst, quota, timeout, retry/backoff, degraded dependencies, rollback and incident communication drills.
- Domain/TLS/DNS, health and readiness from independent browser/network vantage points.

## 6. Expansion (not a launch prerequisite for France MVP)

Belgium, Maghreb, Middle East and Latin America require per-country validation before activation: languages, currencies, tax/invoicing, labor/platform classification, consumer law, privacy/transfer rules, payment-provider availability, insurance and regulated-service boundaries. Do not expose these markets based solely on translation or currency support.

## 7. Release evidence register

Record for every gate: candidate commit/tag, environment, UTC date, test owner, command or scenario, expected/actual result, evidence link, defects, retest, rollback.

| Gate | Required evidence | State |
|---|---|---|
| CI/unit/regression | green run tied to exact commit | PARTIAL: prior CI reported; verify current commit |
| API integration | auth, RBAC, D1, idempotency, ownership, error paths | BLOCKED |
| Browser E2E | client/provider/admin complete journeys on staging | BLOCKED |
| R2 | real authenticated lifecycle and token rotation | BLOCKED |
| Backup/restore | isolated restore with checksum and RPO/RTO | BLOCKED |
| Stripe sandbox | full payment/refund/payout/reconciliation suite | BLOCKED |
| GDPR/legal/insurance | qualified reviewer sign-off | BLOCKED |
| Operational readiness | alert/incident/rollback drill | BLOCKED |
| Production authorization | explicit named human approval and timestamp | NOT GRANTED |

## 8. Change-control boundaries

- Keep all current work on preproduction branches.
- Do not merge PRs, apply D1 migrations, modify production Workers/DNS/billing, or process real payments without a separate explicit approval.
- Production GO requires every mandatory gate PASS, no unresolved critical/high security issue, verified backup/restore, legal/privacy/insurance review, rollback plan, and an explicit human decision.
- This register is a traceability aid, not evidence that any feature is implemented or certified.


## 9. Security review addendum — 2026-11-07

A dedicated CSRF/session hardening gate was added at `docs/CSRF-SESSION-HARDENING-GATE-2026-11-07.md` (commit `c45ce4500954a60a7e4b711b87da6b3d48fb6b83`). It records the observed risk that cookie sessions use `SameSite=None`, `X-CSRF-Token` is allowed by preflight, but no verified token issuance/validation proof is established by the reviewed code. **CSRF remains a production blocker until implemented and covered by the negative test matrix.** This is documentation/audit evidence, not implementation completion.
