# NEXUS SUPRA TRANSVERSAL — execution architecture and delivery roadmap (V1)
Date: 2026-11-09
Status: target architecture and implementation plan; not evidence of runtime capability.

## 1. Mandate

NEXUS SUPRA TRANSVERSAL is the executive intelligence and orchestration plane for PROCHÉLIA. It must understand the whole organization, correlate authorized signals, detect risks and opportunities, prepare coordinated actions, execute only explicitly permitted operations, verify outcomes and report measurable impact.

It is not an unrestricted superuser, legal representative, bank signatory, clinical decision-maker or substitute for human accountability.

## 2. Cross-functional directorates

One shared governance layer coordinates specialized domain capabilities:
1. General management and strategy.
2. Product, research and innovation.
3. Engineering, architecture and infrastructure.
4. Finance, pricing and unit economics.
5. Sales, partnerships and customer success.
6. Marketing, SEO and organic growth.
7. Marketplace and provider operations.
8. PROCHÉLIA DOMICILE operations and safeguarding.
9. TALENT and skills development.
10. Legal research, privacy and compliance.
11. Trust, safety, support and disputes.
12. International market operations.

These are logical capabilities, not necessarily separate AI agents or autonomous legal departments. Shared evidence, permissions, audit, data contracts and objectives are mandatory.

## 3. Executive control loop

For each event or objective:
1. Observe authorized signals.
2. Normalize and classify with source provenance.
3. Separate verified facts, user assertions, model inference and unknowns.
4. Assess urgency, confidence, customer/provider impact, safety, financial impact and jurisdiction.
5. Identify root causes and affected workflows.
6. Generate options and quantify expected value, costs, uncertainty and reversibility.
7. Check tenant, identity, role, resource ownership, scope, country policy, approval and rate limits server-side.
8. Prepare a bounded action plan with idempotency key, timeout, rollback/compensation and expected result.
9. Execute only allowlisted actions permitted at the current autonomy tier.
10. Verify the result from authoritative system state, not from the model's own claim.
11. Write an append-only audit record and monitor for regressions.
12. Escalate exceptions to the responsible human owner.

## 4. Autonomy and approval model

- T0 Observe: read authorized metrics and events.
- T1 Recommend: explain options and tradeoffs.
- T2 Prepare: draft tickets, messages, tests, patches, plans and reconciliations.
- T3 Execute: low-risk, reversible, preapproved and idempotent actions only, with budgets and kill switches.
- T4 Human approval: all live financial operations, material pricing/commission changes, refunds outside preapproved limits, legal/contractual determinations, regulated-service activation, safeguarding decisions, account restrictions, personal-data rights, production releases, database migrations, country activation and external commitments.

Model-generated text cannot grant permissions or be accepted as proof. Approval must be a distinct authenticated action by an authorized person. No self-approval by SUPRA.

## 5. Core services to implement or verify

- Event ingestion with source allowlist, schema validation and tenant context.
- Canonical business event envelope with event ID, occurred/received timestamps, actor, tenant, domain, resource, jurisdiction, source and correlation ID.
- Domain registry and capability catalogue with owner, version, permissions and health.
- Evidence store with provenance, retention and access policy.
- Policy engine deterministic and independent of LLM output.
- Planner producing typed, schema-validated action proposals.
- Approval service with authenticated approver, reason, scope, expiry and one-time binding to action hash.
- Action runner with allowlist, idempotency, rate limits, timeout, retry and compensation.
- Outcome verifier reading authoritative application/PSP state.
- Append-only audit trail and operational dashboard.
- Evaluation harness for accuracy, refusal, prompt injection, privilege escalation, tool misuse, data leakage and outcome quality.
- Provider/model abstraction with timeout, budget, fallback and no-AI safe mode.

## 6. Security and AI threat model

Threats include prompt injection in customer/provider content, forged evidence, cross-tenant data leakage, tool privilege escalation, replay, malicious uploads, poisoned retrieval, model hallucination, runaway loops and unintended external communication.

Controls:
- treat all user and retrieved content as untrusted data;
- never place secrets or unnecessary personal data in prompts;
- server-side authorization for every tool call;
- typed tool schemas and allowlisted actions;
- no arbitrary SQL, shell, secrets retrieval or unrestricted HTTP tools;
- validate outputs independently and reject unknown fields;
- isolate tenant context and test IDOR;
- bind approvals to immutable action hashes and expiry;
- idempotency, budgets, circuit breakers and kill switches;
- log decisions without logging sensitive payloads;
- maintain regression tests for injection, spoofed role, fake payment evidence and cross-tenant references.

## 7. Required cross-domain outcomes

SUPRA should measure and coordinate:
- opportunity creation and time-to-first-qualified-lead;
- provider activation, first completed mission and payout reconciliation;
- home-service continuity, late/no-show, replacement and safeguarding escalations;
- client outcomes, satisfaction and complaint resolution;
- provider net earnings and fairness;
- contribution margin, cash runway and payment reconciliation;
- platform reliability, security, support burden and release health;
- country-pack status and expiring approvals.

It must not optimize GMV or platform margin alone. A proposal that improves platform margin by materially harming provider economics or customer outcomes should be rejected or escalated.

## 8. Implementation sequence (no blind branch merges)

### Stage 0 — inventory and evidence
- Map main entrypoints, routes, middleware, sessions, D1 schema, migrations, workflows, secrets names, UI clients and existing tests.
- Inventory every open PR and feature branch; record base/head SHAs and changed-file overlap.
- Identify duplicate implementations and canonical paths.
- Create a route/data-flow/permission matrix.
- Reconcile current SUPRA/NEXUS work with the main branch before porting code.

Exit: reviewed dependency graph, migration ledger, test map and approved integration base.

### Stage 1 — safe business foundations
- Establish canonical service catalogue and jurisdiction/service eligibility model.
- Define canonical provider/client/organization identity and authorization.
- Establish mission state machine, immutable quote snapshots and audit events.
- Confirm privacy classification and data retention.
- Add contract and property tests for tenant isolation, ownership, idempotency and forbidden transitions.

Exit: no unverified provider or service can reach assignment; core workflow works in isolated D1.

### Stage 2 — home services pilot
- Implement non-clinical service code allowlist for one approved locality.
- Add provider document/insurance checks, beneficiary consent and role-scoped visit details.
- Add scheduling conflicts, recurring visit, replacement and incident escalation.
- Integrate support and human safeguarding queue.
- Validate with supervised operational scenarios and independent local review.

Exit: pilot safety, continuity, provider earnings and customer outcomes meet written thresholds.

### Stage 3 — opportunity and business engine
- Build opportunity hypotheses from authorized aggregate demand/capacity signals.
- Add provider skill evidence and business launch workflows.
- Add quote economics and provider/customer/platform outcome scorecard.
- Run controlled experiments and report incremental outcomes rather than model-generated claims.

Exit: measured lift in qualified opportunities and completed income-generating work without worsening safety/fairness.

### Stage 4 — SUPRA executive orchestration
- Add event bus/registry, evidence provenance, policy engine, planner, approval service, action runner, outcome verifier and audit UI.
- Start T0/T1, then T2; T3 only for narrow reversible tasks after security review.
- Keep T4 human approval and no-AI safe path.
- Run adversarial tests and independent review.

Exit: end-to-end trace from signal to verified outcome; no unauthorized tool execution.

### Stage 5 — country packs and international expansion
- Build country configuration schema and review workflow.
- France and Algeria each require independent service-by-service legal, PSP, privacy, insurance and operations review.
- Add language/RTL/locale/currency support only with local validation.
- Launch one country/service canary at a time.

Exit: signed country pack, test evidence, human activation and rollback/stop procedure.

## 9. Engineering gates and production readiness

Every code change must have:
- narrow scope and root-cause explanation;
- tests at unit, integration, contract and browser levels as appropriate;
- D1 migration forward/backward or explicit irreversible plan;
- security/privacy impact assessment;
- observability and alerting;
- backup and restore proof;
- rollout and rollback plan;
- CI run tied to exact commit SHA;
- post-deploy health and business verification.

Production remains NO-GO until the existing blockers are closed with evidence: session/browser E2E, remote preview D1 integration, full restore drill, PSP sandbox reconciliation, mission workflow and ownership, SUPRA/TALENT runtime integration, safeguarding, security/privacy review, legal country pack and operational support. Do not merge divergent PRs in bulk. Do not deploy, migrate, enable live charges/payouts or activate a country based solely on this roadmap.

## 10. Delivery principle

Build the smallest complete vertical slice, not a broad collection of disconnected features. Each slice must work for a real client, a real provider and PROCHÉLIA's operating team, and must demonstrate safety, fairness, measurable value and sustainable unit economics before expansion.
