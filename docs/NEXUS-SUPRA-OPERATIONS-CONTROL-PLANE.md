# PROCHÉLIA — NEXUS SUPRA Operations Control Plane

Status: candidate architecture specification. This document defines the target operating model; it does not claim that the described capabilities are implemented, deployed, legally validated, or authorized for production.

## 1. Non-negotiable mission

NEXUS SUPRA is the operational intelligence and orchestration layer for PROCHÉLIA. It must supervise the platform continuously (24/7), understand the state of each business domain, detect anomalies, prioritize risks, coordinate workflows, recommend decisions, execute explicitly delegated low-risk actions, verify outcomes, and produce an auditable account of what happened.

It is not a chatbot, a decorative dashboard, or an unrestricted autonomous superuser. It is a governed control plane over well-defined domain services. It must never invent an execution result, bypass authorization, conceal uncertainty, or represent a proposal as a completed action.

The same control plane serves France and Algeria while applying jurisdiction-specific configuration, contracts, payment rails, tax treatment, data rules, and operational partners. International expansion adds jurisdiction packs; it must not silently reuse French or Algerian rules elsewhere.

## 2. Coverage: every operating domain

NEXUS SUPRA must have a versioned capability registry and operational view for:

1. Client experience: onboarding, identity assurance, request creation, quotes, booking, communication, satisfaction, complaints, refunds workflow.
2. Intervenant experience: recruitment, identity and document checks, qualifications, insurance, availability, matching, applications, assignment, secure check-in, service execution, evidence, completion, support and payment status.
3. Enterprise experience: organization onboarding, tenant administration, workforce needs, approvals, service orders, invoices, reporting and account support.
4. Marketplace operations: supply/demand balance, matching quality, coverage gaps, cancellations, no-shows, service quality and dispute queues.
5. Pricing and unit economics: quote construction, commission, payment costs, taxes, insurance costs, refunds, contribution margin and jurisdiction-specific floors/ceilings.
6. Finance: accounting ledger, receivables, payables, settlement, reconciliation, chargebacks, refunds, payout eligibility, cash and anomaly detection.
7. Legal and compliance: jurisdiction rules, contract versions, consent records, retention, data-subject requests, incident handling and human legal review.
8. Trust and safety: fraud signals, account takeover, collusion, abuse, document tampering, safeguarding escalation and proportionate restrictions.
9. Security and privacy: identity, session revocation, tenant isolation, device trust, secrets, access review, audit, vulnerability and incident management.
10. Product and engineering: CI/CD health, release readiness, schema compatibility, error budgets, dependencies, cost, backups, restore drills and rollback readiness.
11. Customer support and mediation: triage, evidence gathering, SLA, escalation, resolution proposals, communication and post-incident learning.
12. Business continuity: outages, regional disruption, payment provider failure, storage failure, cyber incident, staffing shortage and crisis playbooks.
13. Executive direction: strategy, OKRs, growth, retention, liquidity, margins, quality, risk appetite, country readiness and board/owner reporting.

Every domain has a named human owner, an accountable service, documented inputs/outputs, measurable SLOs, escalation rules and a tested fallback. NEXUS SUPRA coordinates; it does not erase professional accountability.

## 3. Autonomy model: action is permissioned

Every proposed or executed action must be classified before execution:

- A0 Observe: read authorized telemetry and records.
- A1 Analyze: correlate, score, forecast and explain; no writes.
- A2 Recommend: prepare a decision, draft or remediation plan; human chooses.
- A3 Delegated reversible operation: execute only pre-approved, bounded, reversible actions (for example retrying an idempotent job, refreshing a cache, opening an incident, sending a permitted operational notification, or pausing a non-financial queue under a documented policy).
- A4 Sensitive operation: require explicit authorized human approval, strong authentication, clear impact preview and a second confirmation where configured.
- A5 Prohibited autonomous action: no self-granted privilege, no bypass of law or policy, no hidden payment movement, no unilateral legal commitment, no deletion of audit evidence, no irreversible sanction or production migration without required approvals.

The policy engine evaluates actor, role, tenant, jurisdiction, resource ownership, data classification, risk, action scope, reversibility, monetary impact, confidence, current incident mode and approval evidence. Default is deny. A model-generated confidence score never substitutes for authorization.

Human approval is mandatory for: production release or migration; enabling real payments; refunds, payouts, transfers and changes to bank/payment destinations; pricing changes that alter an accepted contract; sanctions or account closure; disclosure of sensitive data; legal/tax commitments; changes to retention or privacy policy; and irreversible destructive actions.

## 4. Closed-loop operations

For every workflow NEXUS SUPRA follows the same auditable loop:

1. Observe: retrieve only authorized, tenant-scoped facts and health signals.
2. Validate: check freshness, provenance, completeness and schema/version.
3. Detect: compare against rules, baselines, SLOs and risk indicators.
4. Diagnose: identify likely causes and competing explanations; expose uncertainty.
5. Decide: select a permitted action or escalate to the accountable human.
6. Authorize: evaluate policy and capture required approval before any write.
7. Execute: call a narrow domain API with least privilege, bounded inputs and idempotency.
8. Verify: independently read back the result and check invariants.
9. Recover: retry safely, compensate, quarantine or escalate according to the playbook.
10. Learn: record outcome and update rules only through reviewed, versioned changes.

A request accepted by a queue is not proof of completion. A successful HTTP response is not proof that a financial settlement occurred. A mission marked complete is not proof that the PSP paid. Every status must reflect authoritative evidence.

## 5. 24/7 architecture

Target logical components:

- Event intake: authenticated domain events, webhooks, telemetry and scheduled health checks.
- Event bus/outbox: transactional outbox, deduplication, ordering keys where needed and replay controls.
- Policy engine: deterministic rules, jurisdiction packs, risk limits, approval matrix and deny-by-default evaluation.
- NEXUS SUPRA orchestrator: plans, task graph, bounded tool selection, deadlines, cancellation and escalation.
- Domain services: client, intervenant, enterprise, mission, matching, pricing, finance, trust, support and compliance APIs.
- Durable job workers: leases, bounded retries with jitter, dead-letter queue, poison-message quarantine and replay approval.
- State store: D1 records with tenant-scoped constraints and migrations; R2 for encrypted, classified objects where approved.
- Secrets and keys: managed secrets, rotation, least privilege, no secrets in prompts/logs/client bundles.
- Observability: structured logs, traces, metrics, audit events, health checks, SLOs and cost telemetry.
- Human command center: approvals, incident queues, explanations, action history, kill switch and delegated-scope management.
- Recovery plane: backups, restore validation, regional and provider failover plans, rollback and continuity exercises.

Availability must not depend on a single model call. Deterministic workflows and safety controls continue when the AI provider is unavailable. Queue backpressure, circuit breakers, degraded modes and manual operations are first-class states. Cron alone is not a guarantee of continuous operation; workers, triggers, queue consumers, alerts and ownership must be verified in the deployed environment.

## 6. Canonical data and tenant boundaries

- One canonical mission dossier is shared by role-specific views; no parallel mission truth.
- Identity is established by the server session. Active tenant is resolved server-side, never trusted from a request body or arbitrary header.
- Every query and mutation is tenant-scoped and ownership-checked, including nested objects and guessed identifiers.
- Separate user identity, tenant membership, professional profile and permissions.
- Use immutable audit events and append-only financial entries; corrections use compensating records.
- Use optimistic concurrency/version checks and conditional state transitions.
- Enforce unique idempotency keys at database level for replayable writes.
- Data classification, purpose limitation, retention and access policy are explicit per field/object.
- Public opportunity data must be minimized; private client/intervenant details are disclosed only after the appropriate authorization and business stage.

## 7. Mission orchestration

Canonical lifecycle:

OPEN → APPLICATION_SUBMITTED → SHORTLISTED/REJECTED/WITHDRAWN → ASSIGNED → READY_TO_START → IN_PROGRESS → SUBMITTED_FOR_REVIEW → APPROVED or DISPUTED → PAYABLE → PAYOUT_PENDING → PAID.

Cancellation, no-show, incident, interrupted service, rescheduling and refund are explicit side paths with reason codes and policy. No client or intervenant can set arbitrary terminal states. State transitions are conditional, versioned, atomic and audited. The party who performs the service cannot approve their own completion. Evidence is proportionate and privacy-minimized; continuous location tracking is not a default requirement.

Secure start requires an actually implemented device-enrollment and proof-of-possession mechanism, short-lived mission-bound challenge, replay protection, server-side time window, revocation and recovery. User-Agent or a client-supplied device ID is not proof of device trust. Until this is implemented and tested, secure-start actions remain fail-closed.

## 8. Finance and payments

Separate these facts: estimated amount, contractually accepted amount, service submitted, service approved, amount payable, payout requested, PSP processing, PSP-confirmed settlement and reconciled paid state.

- The accounting ledger is authoritative, balanced, append-only and uses compensating entries.
- Every entry references tenant, mission, invoice, fee/commission, currency, jurisdiction and external PSP event where applicable.
- Webhooks require signature verification, timestamp/replay controls, idempotent processing and reconciliation.
- Receiving capability and payout-to-bank capability are distinct statuses.
- No wallet balance, payable amount or PAID status may be fabricated from a mission state.
- Real-money operations stay disabled until PSP Sandbox E2E, refunds, disputes, settlement reconciliation, legal review and explicit human production authorization all pass.

## 9. Security, trust and privacy

- Least privilege, short-lived credentials, session expiration/revocation and device lifecycle.
- Strong tenant isolation and cross-tenant negative tests.
- Rate limits, abuse detection, anti-enumeration, secure password recovery and account takeover response.
- Encryption in transit and at rest; key rotation and access logging.
- File type/size validation, malware scanning, private object storage and short-lived signed URLs.
- Append-only audit with correlation IDs and redaction of secrets and unnecessary personal data.
- Privacy by design: purpose limitation, data minimization, retention schedule, access/export/correction/deletion workflows and documented legal basis.
- Human review for high-impact trust/safety decisions; explainable reasons, appeal path and proportionality.
- Security incidents trigger containment, evidence preservation, owner notification and tested recovery.

## 10. Pricing, matching and commercial intelligence

NEXUS SUPRA may forecast demand, detect supply shortages, recommend provider matching, estimate travel/time costs and simulate prices. Matching must be explainable and must not discriminate unlawfully. Qualifications, availability, location precision and personal data are used only when necessary and disclosed appropriately.

Price proposals must show client total, intervenant remuneration, platform commission, taxes/fees where applicable, insurance or third-party costs, cancellation terms and estimated contribution margin. An accepted quote is immutable unless the parties explicitly amend it. Dynamic pricing must have caps, anti-exploitation controls, audit and human-approved policy changes.

## 11. International and jurisdiction packs

Each launch country requires a reviewed pack for: entity/contract model, worker classification, consumer rights, tax/VAT, invoicing, payment services, currency and FX, insurance, safeguarding, data protection, cross-border transfers, records retention, language, customer support and dispute handling.

France and Algeria must be modeled separately. No assumption that one country's payment provider, employment model, tax rate or data transfer mechanism is valid in the other. Launch readiness is country-specific and requires local professional validation.

## 12. User-facing interfaces

Client: clear request, quote, booking, provider identity/qualification status, secure messaging, schedule, service tracking with proportionate privacy, completion, invoice, support and dispute.

Intervenant: guided onboarding, profile, qualifications, insurance/documents, verified skills, availability, opportunities, applications, assignments, preparation, secure start, service checklist, evidence, completion submission, payment milestones, incident and support.

Enterprise: organization and tenant administration, member roles, service needs, budgets, approvals, workforce coordination, invoices, reporting and audit exports.

Direction: real-time operational command center, financial health, quality, risk, compliance, incidents, country readiness, AI recommendations, approvals, action history, cost and kill switch.

All interfaces use accessible responsive design, localization, clear error states, offline/degraded behavior and privacy-minimized notifications.

## 13. SLOs, alerting and continuity

Define and approve per-service SLOs for availability, latency, error rate, queue age, job completion, data freshness and recovery. Define RTO/RPO by data class and business impact. Alerts require severity, owner, runbook, escalation deadline and evidence. Monitor at least: API health, database latency/errors, queue lag, dead-letter count, failed webhooks, payment reconciliation gaps, mission aging, document expiry, suspicious activity, backup freshness, restore test age, storage errors, cost spikes and AI provider availability.

Provide global and per-domain kill switches. A kill switch must stop new risky actions without destroying evidence or blocking safe read-only/manual support. Degraded modes must be tested, not merely documented.

## 14. Test and release gates

- Unit and property tests for policy decisions, transitions, pricing and tenant scoping.
- Negative authorization matrix for every role and tenant.
- Concurrency and idempotency tests for mission, availability, invitations, ledger and webhooks.
- Contract tests for every external provider.
- End-to-end journeys across client, intervenant, enterprise and direction.
- Failure injection for database, queue, object storage, email, PSP and AI provider.
- Backup encryption, download, restore into isolated D1, integrity checks and recovery attestation.
- Accessibility, localization, mobile and degraded-network tests.
- Security review, dependency scanning, secret scanning and independent penetration testing.
- Exact-commit CI evidence and deployment identity verification.
- Preview-only migrations and isolated datasets before any production proposal.

A green build is not a production approval. Production requires all gates, a documented change plan, rollback, human approval and post-deployment verification.

## 15. Rollout sequence

1. Inventory current APIs, schema, migrations, routes, UI, bindings, workflows and deployed versions.
2. Establish a canonical base branch and reconcile stacked/divergent PRs without duplicate migrations.
3. Finish tenant invitation, account activation, membership and profile onboarding.
4. Complete intervenant document/qualification lifecycle and review tools.
5. Complete mission state machine and client/enterprise approvals.
6. Implement secure device enrollment and mission start; keep actions closed until verified.
7. Implement evidence, completion, disputes and support.
8. Complete ledger, PSP Sandbox E2E and reconciliation; no real money before authorization.
9. Complete NEXUS SUPRA event bus, policy engine, orchestrator, approval inbox, runbooks and observability.
10. Complete France and Algeria jurisdiction packs with professional validation.
11. Complete isolated preview E2E, backup/restore, security and resilience tests.
12. Obtain explicit production go/no-go decision and then perform a controlled rollout.

## 16. Current project guardrails

- PRODUCTION remains NO-GO until the owner explicitly changes that decision after evidence review.
- Do not merge PRs, run remote migrations, deploy candidate code to production, enable real payments, alter production secrets or move money without explicit authorization.
- The candidate backend and currently deployed Preview Worker are not interchangeable. Verify Worker service, version, bindings and database identity before every test.
- Do not direct branch-preview traffic to a Worker bound to Production D1.
- Do not declare backup/restore, PSP, device trust, invitation acceptance, mission completion or autonomous operation delivered without successful evidence.
- Preserve the existing accounting migration sequence and reconcile invitation migration numbering before any database application.
- NEXUS SUPRA may prepare changes and run isolated tests in approved candidate environments; production and sensitive actions remain approval-gated.

## 17. Operational proof required for the claim “NEXUS SUPRA runs 24/7”

The claim is accepted only when evidence demonstrates:
- deployed event intake and durable consumers;
- active schedules/triggers and monitored heartbeats;
- successful task execution and outcome verification;
- bounded retry and dead-letter recovery;
- alert delivery and staffed escalation;
- model/provider outage fallback;
- least-privilege service identities and audited approvals;
- tested kill switches and manual operating mode;
- tested backup restoration and documented RTO/RPO;
- dashboards and incident records showing actual operation over a sustained observation window.

Until then, “24/7 autonomous operation” is a target architecture, not a proven live capability.


## 18. Candidate implementation update — action policy enforcement

The candidate branch now contains:
- `src/supra-action-policy.mjs`: a deny-by-default registry for ten action classes, including notifications, mission rescheduling, replacement assignment, refunds, payouts, accounting entries, production releases/migrations, account sanctions and account deletion.
- `evaluateSupraActionPolicy`: deterministic checks for registered action type, role, jurisdiction, autonomy level, human approval, tenant scope and idempotency.
- `GET /api/supra/action-policies`: read-only policy catalogue for an authenticated direction user; response explicitly sets `executionAllowed: false`.
- A policy gate at the queued-action execution boundary. The current caller deliberately supplies no trusted jurisdiction, approval, autonomy grant or tenant-scope proof, so execution is blocked until server-side tenant resolution, approval-ledger lookup and a verified executor are integrated.
- Regression tests for policy denial, forbidden high-risk actions, read-only catalogue access and runtime enforcement.

This is an intentional fail-closed integration stage, not a claim that all actions are now executable. The next implementation must resolve tenant and jurisdiction from authoritative database/session context, bind approvals to a specific action and payload hash, and only then enable individually verified executors. Never trust request-body claims for role, tenant, jurisdiction, autonomy or approval.

Validation status for this update:
- Static source inspection and JavaScript syntax parsing succeeded for the candidate source, policy module, API module and test file.
- The GitHub workflow-run lookup returned no PR-triggered runs for the latest candidate commit. The regression suite has therefore not been reported as executed or passed.
- No remote migration, deployment, production mutation, payment activation or merge was performed.
