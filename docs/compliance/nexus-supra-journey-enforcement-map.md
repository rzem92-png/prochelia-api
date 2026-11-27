# Nexus Supra — Compliance enforcement map for business journeys

Status: Preview design / advisory. This is not legal certification and does not activate controls in production.

## Purpose
Convert the legal-commercial matrix into explicit control points across user journeys. A control is enforceable only after implementation, testing, evidence, authorized owner review and integration verification. No control may be marked operational solely because it appears in this map.

## Common gate contract
Every gate must receive trusted, server-derived context: tenant, actor ID/role, country/jurisdiction, activity, customer type, marketplace role, journey/action, policy profile version, current time, correlation ID. Never trust jurisdiction, role, price, eligibility or permissions supplied only by the client.

Each decision must emit a minimal structured result: gate/control IDs, policy version, evidence references, outcome (PASS/BLOCK/REVIEW/NOT_APPLICABLE), reason codes, timestamp, correlation ID and reviewer/approval references where applicable. Do not place secrets, payment data, identity documents or unnecessary personal data in logs.

- Missing, stale, contradictory or unverifiable mandatory evidence => BLOCK or REVIEW, never PASS.
- NOT_APPLICABLE requires scoped rationale, reviewer, expiry/recheck date and evidence.
- Exceptions are narrow, time-bound, approved by authorized humans, revocable and audit logged.
- Nexus Supra may perform reversible technical corrections only after validation and test. Legal, financial, contractual, eligibility, account sanctions and production-impacting decisions require authorized review.
- Gate failures must not leak rule text, personal data or sensitive security details to untrusted clients.

## Journey control map

| Journey / action | Mandatory control families | Gate behavior | Safe auto-remediation | Human approval / evidence |
|---|---|---|---|---|
| Registration & account creation | Privacy notices, consent where required, age rules, identity minimization, security, terms | Stop when mandatory notice/age/security condition unmet | Retry-safe validation, formatting, expired-link regeneration | Consent/notice version and event; age-sensitive or identity exceptions reviewed |
| Provider onboarding | Identity/status, activity eligibility, qualifications, insurance, tax, sanctions where lawful, data protection | Ineligible, expired, missing or unverifiable evidence blocks activation | Reminder, document-expiry alert, upload retry, non-sensitive field correction | Authenticity checks, review outcome, scope and expiry |
| Service/offer creation | Activity legality, descriptions, pricing, claims, qualification requirements, geographical scope | Prevent publication if required checks unknown/fail | Flag prohibited terms, missing required fields, draft correction suggestions | Approval for regulated activity, claims, exceptional offer |
| Search, ranking, recommendations | Transparency, ranking criteria, sponsored/paid placement, fairness, consumer info | Never misrepresent paid placement; suppress unsafe/ineligible listings | Recalculate safe ranking inputs, flag anomalous ranking | Ranking methodology/version, commercial links and placements |
| Quote / pre-contract | Total price, fees, taxes, service scope, timing, cancellation, consumer information, provider identity | No checkout if material information missing or price is inconsistent | Recompute totals from server-authoritative components; invalidate stale quote | Quote snapshot, disclosures version, customer acknowledgement as legally required |
| Booking / contract formation | Terms, party identity, scope, date, cancellation, withdrawal analysis, contract records | Block contract creation on unresolved mandatory terms | Expiry/duplicate booking cleanup, idempotent retry | Contract version, accepted terms, jurisdiction profile, event history |
| Payment / escrow / payout | PSP authorization, payment security, AML/KYC as applicable, payment role/licensing, payout entitlement, fraud | Block financial operation when PSP, entitlement, risk or evidence unresolved | Retry idempotently; reconcile non-sensitive status; freeze duplicate attempt | PSP reference, authorization, reconciliation, human financial approval; never expose secrets |
| Service execution | Safety, scope, provider eligibility, incident protocol, customer communications | Pause/suspend when safety or eligibility condition is unresolved | Notifications, safe scheduling alternatives, incident ticket | Incident evidence, parties' statements, qualified review |
| Completion / invoice | Completion evidence, invoice requirements, taxes, dispute window, accurate charge | No settlement/completion status without required evidence | Validate format, deduplicate, correct arithmetic | Evidence, invoice snapshot, approval if disputed |
| Refund / cancellation / dispute | Consumer rights, contract, refund policy, PSP rules, evidence, abuse/fraud | Entitlement decision requires applicable policy and evidence; uncertain cases review | Calculate proposed amount; prepare reversible draft; prevent duplicate refund | Authorized refund decision, PSP result, reason and timeline |
| Reviews / claims / complaints | Authenticity, moderation, retaliation, mediation, deadlines, DSA obligations where applicable | Preserve notice and route; do not suppress lawful complaint | Duplicate grouping, acknowledgment, deadline reminders | Moderation/legal review for contested content, evidence and decision trail |
| Account suspension / termination | Contract, proportionality, safety, fraud, notice, appeal, discrimination risk | Restriction based on policy and evidence; critical cases review | Temporary risk lock if policy permits and reversible | Reasons, evidence, notice, appeal, human approval for permanent sanctions |
| Data rights / privacy | Access, correction, deletion, portability, retention, controller/processor roles | Route requests, verify identity proportionately, enforce deadlines | Intake, reminders, scoped export/retention workflow | Request record, response evidence, legal retention exceptions |
| Tax / reporting | Country-specific classification, DAC7 or equivalent, invoices, thresholds, reporting | No reporting determination from incomplete data; block false attestation | Data completeness checks, discrepancy alerts | Tax review, source records, submissions and corrections |
| Country / region launch | Market profile, local law, language, currency, consumer, provider, tax, payment, privacy, safety | Launch gate remains BLOCK until all required controls have current evidence and sign-off | Checklist generation, source freshness alert | Local qualified counsel, business owner, security, finance and privacy sign-off |

## Required profile dimensions
- Jurisdiction: country, subnational region when relevant, place of service and customer/provider location.
- Activity taxonomy: precise service category and any regulated/prohibited classification.
- Marketplace role: intermediary, agent, seller, service provider, employer-like role, payment facilitator, controller/processor as determined by actual facts.
- Customer type: consumer/business, vulnerable-user and age-related conditions where relevant.
- Provider type: individual/company, legal status and qualification/insurance conditions.
- Product surface and action: browse, publish, quote, contract, pay, payout, cancel, refund, review, complain, suspend, export, delete, launch.
- Effective dates, source provenance, review date, expiry, evidence and accountable reviewer.

## Enforcement integration acceptance criteria
1. Server-side gates are called at every listed sensitive transition; client-only checks are insufficient.
2. A test proves each gate is fail-closed on missing, stale, contradictory and invalid context.
3. Tenant isolation and actor authorization are verified before evaluation.
4. Gate decision and action are transactionally bound where practical; prevent time-of-check/time-of-use gaps.
5. Idempotency is mandatory for financial and booking mutations.
6. Decision records are append-only or tamper-evident, access-controlled and minimized.
7. A successful gate cannot be replayed across actor, tenant, activity, country, action, policy version or expiry.
8. Tests cover allowed, blocked, review, exception expiry, revocation, concurrency, replay and rollback.
9. Alerting, metrics, dashboards, dead-letter handling and incident escalation are operationally tested.
10. The control owner and qualified legal/operational reviewer approve the profile before a country/activity is launched.

## Nexus Supra orchestration boundaries
- Detect and explain technical or metadata anomalies; generate a prioritized remediation task.
- Auto-correct only low-risk, reversible, deterministic technical issues, then run regression tests and record the before/after hash or change reference.
- Never invent legal sources, credentials, evidence, consent, eligibility, qualification, customer acceptance, payment authorization or legal approval.
- Do not make irreversible financial/legal/account decisions autonomously.
- If sources conflict, are stale, scope is uncertain, or legal interpretation is required: BLOCK/REVIEW and route to a qualified human.
- Production launch and payment activation remain explicit human-controlled NO-GO gates.

## Evidence and audit minimum
Keep a reference to the policy/control version, trusted source metadata, source review, test suite/version, gate outcome, reason code, scoped exception and approver, event/correlation ID, remediation PR/commit, validation result and deployment authorization. Retention periods and access must be defined per jurisdiction and purpose; do not retain data merely for convenience.

## Rollout phases
1. Inventory current journeys/routes and identify control points (no assumptions).
2. Build versioned profile and mapping registry.
3. Implement server-side gate adapter with fail-closed semantics.
4. Add journey-specific integration tests and synthetic data.
5. Add observability and incident playbooks.
6. Run Preview end-to-end and restoration/rollback exercises.
7. Obtain legal, privacy, security, finance and business approvals per country/activity.
8. Production release only through separately authorized change process.
