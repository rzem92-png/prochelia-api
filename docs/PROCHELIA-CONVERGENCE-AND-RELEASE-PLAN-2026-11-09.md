# PROCHÉLIA — convergence, NEXUS SUPRA and release control
Date: 2026-11-09
Branch: integration/prochelia-convergence-plan-2026-11-09
Status: engineering control document; not a production approval or compliance certification.

## 1. Product north star

PROCHÉLIA is a multi-sided services and opportunity ecosystem, not a single booking marketplace. It must serve clients, independent providers/intervenants, small businesses, SMEs, enterprise customers and talent/opportunity participants through coherent, permissioned workspaces.

The product pillars are:
- PROCHÉLIA core: discovery, catalogues, quotes, bookings/missions, scheduling, execution evidence, support, disputes, invoicing and account workspaces.
- PROCHÉLIA TALENT: skills, portfolios, opportunities, applications, missions, career development, employer/partner workflows, trust, moderation and safeguards.
- Home-care / aide à domicile workstream (user-referenced as BGOC): a dedicated service vertical with its own eligibility, safety, qualification, insurance, service-scope and jurisdiction controls. Do not assume the acronym expansion or that all personal-care/healthcare acts are authorized.
- NEXUS SUPRA: the transversal intelligence and orchestration layer across product, operations, trust, finance, growth, support, compliance and engineering.

The economic model must be viable for solo providers and small operators as well as larger organizations. Revenue options may include transparent commissions, B2B subscriptions, paid enterprise capabilities, optional premium tools and service fees, but every offer must be tested against provider earnings, customer value, acquisition cost, payment fees, support burden, refunds, taxes and contribution margin. No opaque fees, pay-to-work promises, or growth spend without an approved budget and measurable return.

## 2. NEXUS SUPRA operating architecture

NEXUS is the orchestration/control plane; SUPRA is the intelligence, analysis and decision-support layer. Neither is an unrestricted superuser.

Required execution chain:
1. Observe only authorized, purpose-limited events and telemetry.
2. Normalize and classify the event; retain provenance and timestamps.
3. Detect anomalies using deterministic controls and measured models.
4. Build an evidence bundle separating verified facts, user statements, model inferences and unknowns.
5. Rank severity, confidence, business impact, safety impact and jurisdiction.
6. Propose a bounded plan with expected outcome, cost, reversibility and risks.
7. Check tenant, role, scope, policy, jurisdiction, rate limit and approval requirements server-side.
8. Execute only allowlisted, idempotent, least-privilege actions.
9. Verify the external/system result; never infer success from a request being sent.
10. Record immutable audit metadata, notify affected parties where appropriate, and monitor follow-up.

### Autonomy tiers
- T0 Observe: metrics, health, events and anomaly detection.
- T1 Recommend: explain findings and propose actions.
- T2 Prepare: draft communications, tickets, tests, patches and reconciliations.
- T3 Execute low-risk reversible operations only under preapproved server policies, limits and idempotency.
- T4 Human approval required: money movement, pricing/commission changes, refunds outside preapproved thresholds, account restrictions, legal/contractual decisions, disputes, personal-data rights, production changes, migrations, country activation and safety-critical actions.

No model output may grant itself permissions, alter authoritative policy, approve its own proposal, bypass tenant isolation, access secrets, or directly issue arbitrary SQL/production commands. A deterministic fallback must preserve essential non-AI workflows if an AI provider is unavailable. Include kill switches, per-agent budgets, timeouts, retry ceilings and incident escalation.

## 3. Cross-product workflows

Every business workflow must have a versioned state machine, explicit owner, allowed transitions, timeout/SLA policy, idempotency key, audit trail, retry/recovery path and human escalation.

Minimum lifecycle:
request → eligibility → quote → customer confirmation → booking/mission → assignment → execution → evidence → completion → invoice/payment reconciliation → review/support → closure.

NEXUS SUPRA must correlate the request, quote snapshot, accepted terms, parties, schedule, service scope, mission events, evidence, invoice, PSP event IDs, refunds and dispute cases. It must detect inconsistencies such as duplicate bookings, unavailable providers, expired documents, overlapping shifts, quote drift, missing consent, unverified completion, duplicate PSP webhooks, ledger imbalance, missed notifications and abnormal support patterns.

Conflicts must be handled impartially: preserve each party's account separately, distinguish fact from allegation, gather proportionate evidence, explain options and preserve appeal. AI must not declare guilt or impose material sanctions automatically.

## 4. Home-care / aide à domicile safeguards

Treat home-care as a controlled vertical, not a generic category label:
- Split household assistance, companionship, errands, cleaning, transport, personal assistance, childcare, care/health acts and any regulated service into explicit service codes.
- Each service code must map to jurisdiction, eligibility, qualifications, declaration/approval/authorization requirements, insurance scope, provider status and permitted tasks.
- Block or hide a service when its legal status, qualification, insurance, safeguarding or local authorization is missing, expired or disputed.
- Establish safeguarding workflows for vulnerable adults, minors, emergencies, abuse allegations, access to the home, keys, medication requests, incident reporting and substitute providers.
- No clinical diagnosis, medication administration, nursing act or other regulated act may be inferred as authorized from a generic aide profile.
- Use minimum necessary identity and household data; protect addresses, access instructions, health-related information and visit schedules with strict role and purpose controls.
- Provide emergency escalation instructions by country; AI must not delay immediate safety action.
- Human review is mandatory for safeguarding incidents, serious complaints, qualification disputes, account restrictions and any decision with significant impact on a vulnerable person.

## 5. Trust, legal responsibility and data protection

Build compliance by actual role and workflow, not by blanket disclaimers. For every country/service pair, maintain versioned official sources, legal review status, operator role, provider obligations, consumer information, cancellation/withdrawal rules, insurance, tax/invoicing, payment structure, data-processing roles, retention, transfers and dispute routes.

Required controls:
- tenant isolation and RBAC tested at API level; deny by default;
- verified session, CSRF and strict credentialed CORS origin allowlists;
- secure cookies, expiry/revocation, MFA where risk warrants, recovery and rate limits;
- input validation, output encoding, upload type/size scanning, SSRF protection, dependency and secret scanning;
- append-only audit events with actor, reason, target, timestamp and correlation ID;
- data minimization, purpose limitation, retention/deletion schedules, export/rectification workflows and processor contracts;
- documented incident response, breach triage, backup/restore, RPO/RTO and access review;
- transparent prices, commissions, ranking and sponsored placement;
- no solely automated decisions with significant effects without the required safeguards and meaningful human review.

Contracts and notices must be reviewed by qualified counsel for the actual marketplace/intermediary/operator model. Insurance coverage must match the real services, geography and responsibilities. No document in this repository is a substitute for legal advice or regulatory authorization.

## 6. Financial safety and sustainable profitability

- Use integer minor units for money; explicit currency and rounding rules; no floating-point financial arithmetic.
- Append-only ledger; balanced entries; ownership binding; immutable quote/fee/tax snapshots.
- PSP is the source of truth for payment status; verify native webhook signatures, timestamp/replay window, event ownership, idempotency and out-of-order delivery.
- Mission, payment, refund and payout state must reconcile under duplicate delivery, concurrency, timeout, crash and retry.
- Do not custody or transmit third-party funds outside the validated PSP/legal structure.
- Keep live capture, refunds, payouts and wallet writes disabled until complete sandbox/runtime tests and written release approval.
- Track contribution margin by service, provider cohort, customer segment, region and channel: GMV, net revenue, provider earnings, PSP fees, refunds, chargebacks, insurance, support, CAC, repeat rate, retention and operating cost.
- Growth campaigns have explicit budget caps, stop-loss rules and attribution; NEXUS may recommend but a manager approves spend and pricing changes.

## 7. Country packs and international rollout

Countries are disabled by default. A country pack must be versioned by country, region, service and role and include language, timezone, currency, tax, invoices, provider status, licensing, insurance, consumer law, privacy/transfers, PSP eligibility, payout rules, customer support, emergencies and official source references.

Required state flow:
DRAFT → LEGAL_REVIEW → PSP_REVIEW → PRIVACY_SECURITY_REVIEW → OPERATIONS_REVIEW → QA_PASSED → HUMAN_APPROVAL → CANARY → ACTIVE.
Any critical failure, expired approval or legal change can move a market to SUSPENDED for new orders. AI may research, monitor and prepare evidence but cannot activate a country.

France remains the initial controlled market. Any subsequent market (including Belgium, Luxembourg or Switzerland) requires its own verified country pack; translation alone is not authorization.

## 8. Integration reality and evidence as of 2026-11-09

- Main branch HEAD at this review: `53e331b058dd1d915e47d1ae0cd046e703735a7f`.
- Production D1 encrypted backup workflow run `42682887433` completed successfully on the exact fix commit. Logs confirm the production D1 target, remote export, local SQLite `PRAGMA integrity_check=ok`, AES-256 encryption, upload to the dedicated EU R2 bucket, download, decryption and SHA-256 verification.
- Verified object key: `production-d1/prochelia-api/2026/11/09/42682887433-53e331b058dd.sql.gpg`; checksum sidecar stored beside it. This proves this backup round-trip only; it does not prove a full disaster-recovery restore drill or recurring backup schedule.
- Main currently contains a deliberately small base and the recent backup correction. The prelaunch audit branch and feature branches contain substantial code, migrations, tests and specifications but are materially divergent from main. The prelaunch audit branch was 496 commits ahead and 55 behind main at comparison time; the NEXUS blueprint branch and SUPRA governance branch are also separate, stale integration lines.
- PRs #91, #90, #12, #36, #88, #87, #35 and #17 were open drafts/unmerged at this review. Their presence is not production evidence. Do not batch-merge or cherry-pick them.
- Historical master audit `docs/PROCHELIA_MASTER_AUDIT_2026-11-07.md` explicitly set production NO-GO pending browser/session, remote preview D1, restore drill, Stripe Sandbox, marketplace/Talent/SUPRA runtime, security/privacy, legal and operational evidence. The successful production backup now closes only the encrypted production backup round-trip item, not the full release gate.

## 9. Safe convergence sequence

1. Freeze and inventory every branch/PR, migration, Worker config, runtime entrypoint, secret binding name and test suite. Build a dependency graph and file-level overlap matrix.
2. Select one integration base from the latest main, then port work in small, reviewed slices. Preserve all original branch heads. Never merge stale feature branches wholesale.
3. Integrate core identity/session/CORS/RBAC and tenant isolation first; run negative cross-tenant tests and real browser tests (iOS Safari, Android Chrome, desktop).
4. Integrate versioned D1 migrations with a single authoritative sequence; resolve duplicate migration numbers before any remote migration; run SQLite/local and disposable preview D1 tests.
5. Integrate marketplace mission state machine, evidence and dispute workflows; test ownership, idempotency, retries, concurrency and failure recovery.
6. Integrate financial adapter, ledger, Stripe Connect and webhooks in Sandbox only; prove full payment/refund/payout/reconciliation flows before considering any live enablement.
7. Integrate SUPRA policy/approval/orchestration and NEXUS matching/marketplace services behind feature flags; run prompt injection, tool abuse, cross-tenant, fairness, cost, latency and outage tests.
8. Integrate Talent and the home-care vertical with dedicated eligibility, safeguarding, privacy and jurisdiction controls; test every role and edge case.
9. Integrate notifications, monitoring, incident handling, accounting exports, retention and restore drills.
10. Complete legal/privacy/insurance review, accessibility, performance, business continuity, support readiness and country pack approval.
11. Require G0–G14 release evidence on one exact candidate SHA, signed human approval, rollback test and progressive canary. Until then, production writes, live payment and new country activation remain closed.

## 10. Stop conditions

Stop and fail closed on any unknown production binding, schema drift, duplicate migration, missing owner, cross-tenant access, invalid signature, ledger imbalance, unverified PSP status, stale approval, unsupported jurisdiction, unverified qualification/insurance, safety incident, untrusted evidence, restore failure or critical/high vulnerability. Report exact evidence and recovery path; never conceal, silently retry a destructive action or mark an unverified workflow complete.

## 11. Definition of done

A module is complete only when its code is integrated on the release candidate, tests pass on the exact SHA, runtime behavior is demonstrated in the intended environment, observability and rollback exist, legal/security gates are satisfied, and the accountable human owner approves it. “AI-powered”, a green static test, a draft PR or a successful backup is not by itself end-to-end readiness.
