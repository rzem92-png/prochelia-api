# Nexus Supra — Executive Operating Charter

**Status:** architecture specification; not an execution authorization.  
**Scope:** PROCHÉLIA only. Do not mix BUSY.N or NEXORA.  
**Objective:** make Nexus Supra the evidence-driven executive intelligence and workflow-orchestration layer for a durable, profitable, resilient marketplace operating first in France and then in approved jurisdictions.

## 1. Executive mandate

Nexus Supra continuously turns verified business signals into:
1. an understandable diagnosis;
2. quantified opportunities and risks;
3. ranked options with assumptions and confidence;
4. an executable plan with owners, dependencies, costs and expected outcomes;
5. controlled actions whose results are measured against the plan.

It must not claim guaranteed wealth, guaranteed forecasts, legal certainty, or superiority to every other AI. Its score is measured by verified business outcomes: sustainable contribution margin, customer value, provider net earnings, retention, service quality, compliance and resilience.

## 2. Executive domains

Every domain follows the same contract: data sources → KPIs → diagnosis → options → approval policy → bounded executor → audit evidence → outcome measurement.

| Domain | Core responsibilities | Example KPIs | Default autonomy |
|---|---|---|---|
| Corporate strategy | objectives, OKRs, market positioning, scenario plans | growth, contribution margin, runway | advise/prepare |
| Finance & treasury | revenue recognition, costs, cash forecast, collections, refunds | cash runway, gross/contribution margin, overdue receivables | read/forecast; financial writes require approval |
| Pricing & commissions | price floors, elasticity, geographic/segment pricing, fee simulations | conversion, margin/order, provider net earnings | simulate; publish after approval |
| Marketplace supply | provider acquisition, capacity, quality, availability | fill rate, time-to-match, active providers | recommend/prepare |
| Customer growth | acquisition, activation, retention, referrals, CRM segmentation | CAC, LTV, conversion, repeat rate | prepare; external sends require approval |
| Provider success | onboarding, earnings, utilization, payout transparency | provider net income, utilization, dispute rate | advise/prepare |
| Partnerships & procurement | partner discovery, qualification, proposal drafting, negotiation briefs, renewals | partner pipeline, expected value, signed value, obligations | draft only; commitments/signatures human |
| Advertising & marketing | channel mix, campaign planning, creative tests, budget/ROI | CAC, ROAS, incremental lift | draft/simulate; spend and publish require approval |
| Product, UX & design | funnel analysis, accessibility, experiments, roadmap | task success, abandonment, conversion | recommend; release requires review |
| Operations & service quality | matching, scheduling, incidents, support, complaints | SLA, resolution time, cancellation, satisfaction | bounded low-risk actions only |
| Trust, safety & fraud | anomaly detection, abuse signals, identity and dispute triage | fraud loss, false-positive rate, incidents | flag/contain; account sanctions human-reviewed |
| Legal & compliance | jurisdiction rules, consumer, commercial, privacy, tax, advertising and payment obligations | open legal risks, control coverage | research/checklist; legal opinion human |
| International expansion | country readiness, localization, FX, partner and regulatory mapping | country score, launch cost, risk-adjusted return | scenario only |
| Crisis & continuity | economic, geopolitical, infrastructure and supply shocks | cash stress, concentration, recovery time | alert/prepare; crisis actions approved |
| Data & intelligence | metric definitions, lineage, data quality, forecasts | freshness, completeness, forecast error | read/diagnose |
| AI governance | model quality, evaluations, prompt/tool controls, audit | groundedness, task success, unsafe-action rate | monitor; policy changes human |

## 3. Executive decision packet

Every material recommendation must contain:
- decision ID, timestamp, tenant/workspace and jurisdiction;
- question and business objective;
- source data references, freshness and lineage;
- assumptions, missing data and confidence interval;
- baseline and at least three scenarios (downside/base/upside);
- expected revenue, direct cost, contribution margin, cash impact and provider/customer impact;
- legal, privacy, security, fraud, reputation and operational risks;
- reversible/irreversible classification;
- proposed action, owner, deadline, rollback and success metric;
- required approver(s), approval expiry and immutable payload hash;
- post-action measurement at 7/30/90 days.

No recommendation may present forecast revenue as guaranteed or confuse GMV with PROCHÉLIA revenue, gross margin, cash or profit.

## 4. Autonomy and execution policy

- **L0 Observe:** read-only access to explicitly authorized, tenant-scoped data.
- **L1 Advise:** analysis, forecasts, alerts and ranked recommendations.
- **L2 Prepare:** draft contracts, messages, quotes, campaigns, pricing changes, tickets and operational plans. Drafts are not sent or published.
- **L3 Execute bounded low-risk actions:** only allowlisted, reversible actions with verified tenant context, RBAC, policy checks, idempotency, rate limits, budget/amount ceilings, audit event and kill switch.
- **Human approval always required:** payments, payouts, refunds outside policy, contracts and signatures, binding negotiations, ad spend, price/commission publication, account suspension/termination, personal-data export/deletion, legal filings, cross-border transfers, production deployments, secrets/policy changes and irreversible actions.

Approvals must be server-side, one-time, action/resource/tenant/amount/currency/payload-hash bound, time-limited and recorded append-only. The requester cannot approve their own critical action. Two distinct approvers are required for critical actions where the governance policy says so. Missing or ambiguous tenant context is a hard denial. Never let the model manufacture an approval.

## 5. Required tools and connectors

Connectors are capability-scoped, not blanket credentials:
- marketplace and D1 read models;
- accounting/invoicing and bank feed read-only first;
- PSP status and reconciliation read-only first;
- CRM, email and support draft-first;
- analytics and product events;
- advertising platform reporting read-only, campaign draft before spend;
- maps/geocoding and scheduling;
- official legal/regulatory sources per jurisdiction;
- FX, macroeconomic and risk feeds with source timestamps;
- GitHub/Cloudflare operations with Preview-only role until explicit release authorization.

Every connector needs a data owner, purpose, scopes, retention rule, tenant filter, secret rotation, outage behavior and test suite. Never expose credentials to the model or browser.

## 6. Core data model

Build explicit, tenant-scoped records for:
- workspaces, memberships, roles and session-bound active workspace;
- immutable business events and source lineage;
- financial ledger entries, invoices, refunds, fees and reconciliations;
- provider earnings and customer savings/value;
- metric definitions and daily snapshots;
- forecasts, assumptions, scenarios and forecast errors;
- recommendations and decision packets;
- approval requests, votes, consumption records and audit events;
- connector grants, tool executions, idempotency keys and reconciliation cases;
- incidents, risks, controls and country/jurisdiction policies.

Never infer tenant identity from a client-supplied ID. Derive it from a validated server-side session and membership. Every query and write must enforce tenant scope.

## 7. Business intelligence and adaptive strategy

The executive dashboard must separate:
- GMV / transaction value;
- PROCHÉLIA recognized revenue;
- provider gross and net earnings;
- customer total price and demonstrable savings;
- refunds, chargebacks, taxes and payment fees;
- gross margin, contribution margin and operating profit;
- cash balance, forecast cash and runway.

Pricing recommendations must account for provider net earnings, customer affordability, local costs, competition, demand, taxes, payment costs and applicable law. Do not optimize only platform take-rate. Run controlled experiments and measure incremental lift, guard against unfair/discriminatory proxies and retain a rollback price book.

Crisis mode uses configurable thresholds, source-backed alerts, stress tests (demand shock, FX shock, payment outage, provider shortage, regulatory change), continuity playbooks and human authorization for consequential actions.

## 8. Delivery gates

**Gate A — secure foundations:** resolve the stacked Preview migration PR order (#236 → #253 → #259 → #261), verify the fresh EU D1 baseline, run the isolated restore drill, then migrate Preview only. No Production writes.

**Gate B — runtime identity:** tenant/workspace membership, server-derived session context, route-level authorization, isolation tests and revocation/expiry.

**Gate C — operational reliability:** outbox atomic claim, idempotency, leases, retries, dead-letter/reconciliation, audit and kill switch.

**Gate D — product truth:** replace prototype/localStorage business paths with API persistence; prove client and provider journeys end to end.

**Gate E — executive intelligence:** financial ledger/metrics, recommendation engine, forecast evaluation, decision packets, tool registry and approval gates.

**Gate F — commercial capabilities:** CRM/partnership pipeline, proposal drafting, ad campaign drafts, pricing simulator, provider earnings and customer savings measurement.

**Gate G — jurisdiction and release:** country-specific legal review, privacy/security review, PSP sandbox E2E, load/recovery, incident response, independent acceptance and explicit human release approval.

## 9. Acceptance criteria

- Tenant-isolation tests prove cross-tenant reads and writes are denied.
- All sensitive tools have least-privilege scopes and deterministic authorization tests.
- Every external side effect is idempotent, audited and reconcilable.
- Every forecast is back-tested; error and confidence are visible.
- Financial metrics reconcile to ledger/PSP/accounting evidence.
- Provider net earnings and customer value are measured, not merely claimed.
- Partnership and advertising workflows stop at draft until authorized.
- Crisis playbooks are tested with simulations.
- A kill switch disables all executors without disabling read-only diagnosis.
- Production remains closed until all release gates pass and the owner explicitly approves.

## 10. Current known constraints

The repository already contains a Nexus governance foundation in PR #234 and Preview migrations 0021/0022, but the PR description states that runtime approvals fail closed until verified tenant context is implemented. The new Preview D1 backup run #44090893693 passed export, AES-256 encryption, private R2 upload/download, decryption, SHA-256 and SQLite checks; this is not yet proof of a remote isolated restore drill. The active Preview Worker bindings and end-to-end application persistence still require verification. No production migration, deployment or live payment is authorized by this charter.
