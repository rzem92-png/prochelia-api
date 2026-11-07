# PROCHÉLIA — release readiness / production gate

**State:** PREPRODUCTION ONLY — production is not authorized by this document.  
**Updated:** 2026-11-07  
**Branch:** `preprod/r2-eu-binding-isolated-2026-11-07`

## Release principle
No release is considered production-ready from unit tests alone. Every gate below requires dated evidence, an owner, a result (PASS/FAIL/BLOCKED), and a rollback plan. Any critical/high unresolved security issue, failed restore, payment reconciliation mismatch, or missing legal approval blocks release.

## Gate 0 — change control and isolation
- [ ] Confirm the exact candidate commit and immutable release tag.
- [ ] Verify production Worker, production D1, DNS, billing, Stripe live mode and customer data are untouched during preproduction.
- [ ] Review branch protection, required CI checks, secret scanning, dependency alerts and deployment permissions.
- [ ] Require human approval for production deployment; no automatic staging-to-production promotion.
- [ ] Ensure staging/prod secrets and databases are distinct; never copy production personal data into staging.

## Gate 1 — application and API security
- [ ] Inventory endpoints, methods, auth requirements, roles, and data classification.
- [ ] Verify session cookie Secure, HttpOnly, SameSite, expiry, rotation, logout invalidation and CSRF controls where cookie auth is used.
- [ ] Verify password hashing, reset flows, OTP rate limits, account enumeration resistance, lockout/risk controls.
- [ ] Enforce server-side RBAC and tenant/object ownership on every read/write; deny by default.
- [ ] Validate schemas, payload limits, content types, path/query values and all untrusted input.
- [ ] Check CORS allowlist, security headers, rate limiting, abuse controls and request IDs.
- [ ] Ensure errors/logs do not expose secrets, tokens, stack traces, personal or payment data.
- [ ] Run dependency/SCA, secret scan, static analysis and security tests; document exceptions.
- [ ] Verify no unsafe debug endpoints, bootstrap tokens, test credentials or permissive admin paths remain.

## Gate 2 — R2 and backup/restore
- [ ] Rotate exposed preproduction token; old token rejected (401); new token works.
- [ ] Perform authenticated synthetic PUT → GET (content/metadata integrity) → DELETE → GET (404).
- [ ] Confirm private bucket, no public access, correct EU location/jurisdiction, least-privilege binding.
- [ ] Confirm key prefix isolation, object size/type limits, lifecycle and retention policy.
- [ ] Define backup scope, frequency, encryption/key ownership, retention, immutability/versioning where applicable.
- [ ] Run a real restore into an isolated target; verify checksums, completeness, access controls and documented RTO/RPO.
- [ ] Record evidence without credentials, customer content or sensitive object names.

## Gate 3 — data, D1 and migrations
- [ ] Review schema and migration SQL offline; verify forward and rollback/recovery strategy.
- [ ] Test migration against disposable preproduction copy; no production migration without separate approval.
- [ ] Verify indexes, constraints, idempotency, transaction boundaries and race conditions.
- [ ] Validate backups and restore before any irreversible migration.
- [ ] Verify data minimization, deletion/anonymization, retention, export and access logging.
- [ ] Reconcile app-level and database-level permissions.

## Gate 4 — Stripe / financial controls (sandbox only until approval)
- [ ] Test checkout, payment intent lifecycle, success/failure/cancel, duplicate webhook and retries.
- [ ] Verify webhook signature, timestamp tolerance, idempotency and replay protection.
- [ ] Test refund/partial refund, concurrent refund attempts, dispute, chargeback and reconciliation.
- [ ] Confirm platform commission, provider payout, taxes, fees, rounding and currency arithmetic.
- [ ] Confirm no card data is stored by PROCHÉLIA; use provider-hosted/tokenized flows.
- [ ] Verify sandbox and live credentials/URLs are strictly separated.
- [ ] Human finance approval before live mode or real funds.

## Gate 5 — product/business correctness
- [ ] Client, intervenant and admin journeys tested end-to-end.
- [ ] Booking state transitions, cancellation, no-show, disputes and notifications tested.
- [ ] Provider identity/document checks and least-privilege profile visibility verified.
- [ ] Pricing, surcharges, commissions, invoices and receipts reproducible and auditable.
- [ ] GPS/location permissions, consent and retention reviewed; avoid continuous tracking outside mission context.
- [ ] Accessibility, responsive layout, error recovery, localization and support flows checked.

## Gate 6 — legal, privacy and operational readiness
- [ ] French/EU counsel or qualified reviewer approves platform/intermediary status, provider contracts, client terms, liability and cancellation rules.
- [ ] GDPR data map, lawful bases, privacy notices, processor agreements, DPA, transfers, retention and rights handling documented.
- [ ] Assess whether DPIA is required; complete before processing high-risk data if required.
- [ ] Verify CNIL cookie/consent obligations, marketing consent, contact details and incident notification procedure.
- [ ] Insurance, consumer information, invoicing/tax and regulated-service boundaries reviewed.
- [ ] Support escalation, abuse reports, incident response and breach playbook rehearsed.

## Gate 7 — resilience, observability and rollback
- [ ] Load, burst, latency, quota, timeout, retry and degraded-provider tests performed.
- [ ] Verify circuit breakers/backoff where relevant; avoid retry storms.
- [ ] Dashboards/alerts cover errors, auth anomalies, queue/webhook lag, storage, billing and availability.
- [ ] Logs are structured, redacted, access-controlled and retention-limited.
- [ ] Run rollback drill; verify rollback does not lose or corrupt data.
- [ ] Define RTO/RPO, on-call owner, incident severity and customer communication process.
- [ ] Verify domain, TLS, DNS, health checks and monitoring from independent vantage points.

## Gate 8 — final launch decision
Required signed record:
- Candidate commit/tag:
- CI and test evidence:
- Security review / unresolved findings:
- R2 live validation and restore evidence:
- Migration approval (if any):
- Stripe live-mode approval:
- Legal/privacy approval:
- Operational owner and support readiness:
- Rollback plan and verified backup:
- Explicit production authorization (person + timestamp):

**Decision:** GO only when all mandatory gates pass and the accountable human owner explicitly authorizes production. Otherwise NO-GO / BLOCKED.

## Current known state
- Isolated R2 smoke Worker code and mock tests exist.
- CI for recent security header/auth tests has passed (check current workflow status before relying on it).
- Real R2 authenticated HTTP lifecycle, old-token rejection, and backup restore are not yet evidenced here.
- This checklist is a readiness plan, not proof that controls are implemented or production is safe.
