# PROCHÉLIA — Functional completeness & expert integration backlog
Date: 2026-11-04
Status: **requirements / architecture gates; not a claim of implemented or tested functionality**

This backlog adds critical product, security, operations and marketplace capabilities that can be easy to overlook. It is intended to be reviewed against the existing frontend/API before implementation. It does not authorize production deployment, D1 migration, live PSP activity or merging.

## Priority convention
- **P0 release blocker:** safety, money, access control, legal/privacy, operational recovery.
- **P1 launch essential:** user trust, service completion, support and core marketplace integrity.
- **P2 growth:** differentiation, retention and optimization.
Each feature must be tied to an owner, acceptance criteria, automated tests and evidence. Never label “done” solely because a UI exists.

## P0 — Safety, trust and financial integrity
### A. Trust & safety / incident response
- Client and provider can report an urgent incident from a mission; include “not emergency services” warning and French emergency numbers only where appropriate.
- Report/block users, prevent new matching while a case is under review, preserve evidence with restricted access, and define escalation/response SLAs.
- Safety check-in/out, late/no-show alert, emergency contact (optional, consented), and controlled sharing of mission location/time.
- No automated AI decision may permanently suspend, accuse, or determine liability; human review and appeal.
- Abuse, harassment, discrimination, coercion, unsafe home, vulnerable person safeguarding and suspected fraud playbooks.
- Accessibility for users with disability and support for caregivers; no medical-care claims unless legally qualified.

### B. Money and ledger (authoritative server side)
- Immutable double-entry or equivalent append-only financial ledger: gross price, taxes if applicable, platform commission, provider payable, tips, PSP fees, refunds, chargebacks and adjustments.
- Separate states: quote → authorized → captured/paid → payout pending → paid out; refund requested → approved → PSP pending → confirmed/failed. “Queued” never means paid/refunded.
- Server-calculated tariff and quote snapshot with version, validity/expiry, currency, tax treatment, rounding policy, surge/night/weekend rules and price acceptance.
- Idempotency for checkout, payment, refund, payout, webhook and reconciliation; uniqueness constraints and replay protection based on PSP contract.
- Daily reconciliation between PSP settlements, internal ledger, fees, refunds, chargebacks and provider balances; discrepancy queue with manual resolution.
- Chargeback evidence package, payout holds, negative balance policy, fraud limits and audit history.
- Explicit handling of PSP outage, partial capture, authorization expiry, payout failure, duplicate webhook and out-of-order event.
- PCI scope minimization: no card PAN/CVV in app logs, DB or support screens; use PSP-hosted/tokenized fields.

### C. Access control, privacy and data governance
- Server-side RBAC + object ownership/tenant checks on every read/write/list/export/download; never trust role/permission/owner/payment/document flags from request body.
- Privileged admin MFA, step-up authentication for payout/refund/export/role change, session revocation and device/session list.
- Audit log tamper resistance, sensitive-field redaction, retention schedule and access logs for health/safety incident records.
- Consent/version management: CGU, privacy policy, cookies (if applicable), location, notifications, optional emergency contact, marketing and AI processing; withdrawal flows.
- Data subject workflows: access, portability, correction, deletion/objection; legal retention exceptions and backup deletion timeline.
- Data map and processing register, processors/subprocessors, transfer and hosting review, DPIA screening for geolocation/profiling/vulnerable people; legal counsel/DPO review before launch.
- Minimize exact geolocation retention; show live location only during active mission and to authorized parties.
- Breach playbook, notification deadlines, incident severity, evidence preservation and regulator/customer communication.
- Accessibility compliance plan (WCAG/RGAA target), readable fonts, screen reader, keyboard, contrast, reduced motion, easy French.

## P0 — Reliability and operational controls
- Restore drill, RPO/RTO target, encrypted backups, restore verification, deletion propagation and periodic recovery rehearsal.
- Observability: structured logs, correlation/request IDs, metrics, traces, alert thresholds, uptime/error budgets, incident runbooks; no secrets/PII in logs.
- Rate limiting, abuse throttling, CAPTCHA/step-up where appropriate, anti-enumeration, credential stuffing controls, secure password reset and email/phone change confirmation.
- Secure upload pipeline: private quarantine, MIME sniffing, size caps, malware scan fail-closed, access-bound signed URLs, expiration and deletion.
- Durable queue/outbox, retry policy with jitter, dead-letter queue, idempotent workers, reconciliation and backpressure.
- Feature flags with owner, expiry, kill switch and safe defaults; rollback procedure and versioned config.
- Dependency/SBOM scanning, secret scanning, SAST/DAST, threat model, security review, penetration test and vulnerability disclosure/contact.
- Production release checklist with two-person review for sensitive changes, migration rehearsal, backup before migration and rollback proof.

## P1 — Marketplace service quality
### D. Booking / scheduling contract
- Mission state machine with allowed transitions and actor permissions: draft, quoted, requested, accepted, confirmed, in progress, completed, disputed, cancelled, expired.
- Server-authoritative timezone, DST and calendar rules; no double-booking; atomic reservation/hold and expiry.
- Cancellation/no-show policies by actor and time window, refund/fee calculation, exceptions and appeal.
- Service radius/travel time, provider availability, buffer time, recurring bookings, holidays, rescheduling, waitlist and substitute provider flow.
- Mission details confirmation, address privacy, access instructions, task checklist, start/end timestamps and customer/provider confirmation.
- GPS should be optional where not necessary; QR must not be treated as sole proof of presence; anti-spoofing and dispute handling.

### E. Provider onboarding and compliance
- Identity and eligibility verification, document expiry reminders, status gating; keep sensitive docs private and access restricted.
- Clear provider legal status, insurance/qualification checks by service type, geographic/legal eligibility and responsibility boundaries reviewed by counsel.
- Provider onboarding checklist, payout identity verification via PSP, availability calendar, skills, languages, service area, rate visibility, cancellation reliability.
- Provider profile moderation, review response, appeal, suspend/restore, duplicate account and fraud signals.
- No automatic acceptance of a service requiring professional qualifications without verification.

### F. Client experience and trust
- Guest booking flow with secure contact verification and later account claim; avoid exposing guest bookings.
- Clear total price before commitment, quote expiry, service scope, exclusions, provider profile and cancellation policy.
- Booking status timeline, receipts/invoices, message thread, reminders, rating/review and issue resolution.
- Review authenticity: only completed mission participants; abuse detection, moderation, appeal, conflict-of-interest controls.
- Accessible help center, contact support, complaint tracking, response SLA and escalation.

### G. Communication and notification reliability
- Transactional email/SMS/push templates in localized language, consent/preferences and quiet hours.
- Delivery receipts, retries, duplicate suppression, fallback channel, bounce/opt-out management.
- Avoid sending personal data, precise address or sensitive mission details in push/email; deep links must authenticate and authorize.
- In-app chat with report/block, retention rules, moderation escalation and audit without unnecessary content exposure.

## P1 — SUPRA and Nexus quality boundaries
- SUPRA is a copilot with scoped tools and separate permissions; all tool actions re-authorize server-side.
- Prompt injection defenses: external text/documents are untrusted, never override system policy; no secrets in context; tool allowlist and bounded budgets.
- Human approval for legal, financial, contractual, identity, refunds, payout, account bans, production deployments and deletion of records.
- AI output provenance, confidence/uncertainty, user-visible explanation, audit of approved actions, rollback/undo where possible.
- AI fallback to human and no silent failure; never claim it completed a tool action unless backend confirms.
- Nexus matching: explainable factors, avoid sensitive data/proxies, monitor fairness, provide user appeal/override, prevent discriminatory ranking.
- AI localization must not fabricate legal or medical translations; high-stakes contract/consent text reviewed by qualified human translator/legal counsel.

## P1 — Internationalization and local readiness
- Locale-aware UI/content, pluralization, date/time/currency/number formats, timezone and RTL support (Arabic/Darija), accessibility in translated layouts.
- Separate translation strings from code; glossary, fallback locale, versioned translations and review workflow.
- Language preference for clients and providers; only show claimed spoken languages, not infer ethnicity.
- Country-by-country launch checklist: legal services boundaries, employment/independent contractor classification, tax/VAT, consumer rights, payment/payout support, data transfers, insurance and dispute resolution.
- Launch country feature flags; do not activate new country until legal/financial/operational sign-off.
- Avoid storing or displaying language labels as sensitive identity attributes; language is voluntary and user supplied.

## P2 — Growth and resilience
- Referral abuse prevention, promo budget caps, attribution windows and fraud review.
- Transparent loyalty/credits policy and expiration rules.
- Business/corporate account support with billing, authorized users and separate data tenancy.
- Metrics: conversion, cancellation/no-show, mission completion, time-to-match, provider utilization, complaint rate, refund/chargeback rate, contribution margin, retention and safety incidents.
- Cost guardrails: AI/token budget, PSP fees, SMS spend, hosting/queue costs, promo limits and margin floor.
- Offline/low-bandwidth progressive enhancement, graceful retry and safe draft preservation.
- Exportable owner reports with access control, minimization and audit.

## Cross-feature acceptance test pattern
For every feature:
1. Unit tests for rules and boundaries.
2. API integration tests against isolated disposable data.
3. Negative tests (unauthorized, malformed, replay, expired, cross-tenant).
4. Concurrent/retry tests where money or scheduling is involved.
5. E2E mobile Safari/iOS and Android plus accessibility checks.
6. Data migration/rollback rehearsal if schema changes.
7. Logs/metrics/alerting verification with sanitized payloads.
8. Human review of legal/safety implications.
9. Evidence attached to PR: commit SHA, test run, environment, timestamp and result.
10. Feature flag, rollback/kill switch and support runbook.

## Suggested launch gates
- **Gate 0:** code inventory and threat model; identify features already implemented and avoid duplicate modules.
- **Gate 1:** P0 security/ledger/privacy/recovery; no production launch until passed.
- **Gate 2:** booking lifecycle, onboarding, communication, support and user trust.
- **Gate 3:** E2E mobile, accessibility, localization, observability and support readiness.
- **Gate 4:** supervised pilot with limited geography/services/users, limits and manual fallback.
- **Gate 5:** human decision to widen rollout; never automatic.

## Explicitly not performed
No application feature was claimed implemented by this document. No database schema changed, no migration ran, no PR merged, no production deploy, no live payment, no legal certification or security certification.
