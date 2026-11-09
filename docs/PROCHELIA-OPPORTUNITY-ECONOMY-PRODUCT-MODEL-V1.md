# PROCHÉLIA — Opportunity Economy product and operating model (V1)
Date: 2026-11-09
Status: target product specification; not a claim that the capabilities are already implemented.

## 1. Product thesis

PROCHÉLIA is designed as an opportunity-creation and service-orchestration infrastructure, not merely a directory or classified-ads marketplace. Its purpose is to help people and organizations move through a measurable path:

**capability → lawful activity → viable offer → qualified demand → trusted fulfilment → verified evidence → income and progression.**

The product must create value for three sides at once:
1. Client / beneficiary: a suitable, safe, transparent and reliable outcome.
2. Intervenant / provider / entrepreneur: fair access to work, clear earnings, reliable payment terms and a path to grow.
3. PROCHÉLIA: sustainable revenue, positive contribution margin, trust and durable retention.

No side's gains should be manufactured by hiding costs or transferring unreasonable risk to another side.

## 2. Product architecture

The following are coherent product domains sharing common identity, trust, billing, notifications, analytics and governance services. They are not separate unconnected applications.

- **PROCHÉLIA SERVICES:** discovery, catalogue, requests, quotes, bookings, missions, scheduling, evidence, invoicing, support and disputes.
- **PROCHÉLIA DOMICILE:** controlled orchestration of home visits and recurring household/personal assistance, with distinct service eligibility, safeguarding, qualification and continuity rules.
- **PROCHÉLIA TALENT:** skills, portfolios, verified experience, opportunities, applications, paid missions and development pathways.
- **PROCHÉLIA BUSINESS:** business launch and operating tools for solo providers, microbusinesses and organizations: offer design, pricing support, catalogue, quotes, customer management, planning, cost tracking and growth.
- **NEXUS SUPRA TRANSVERSAL:** cross-domain intelligence, decision support, coordination, policy-controlled execution and outcome verification.

BGOC / aide à domicile remains a named workstream exactly as supplied by the founder. Do not infer or invent an expansion of BGOC.

## 3. Defensible differentiation hypotheses

Features such as profiles, reviews, AI matching, messaging, calendars, quotes and payments are table stakes and are not unique claims. The differentiation hypothesis is the integrated outcome loop:

### 3.1 Opportunity Engine
- Detect unmet needs using authorized, aggregated and purpose-limited signals.
- Identify relevant local capabilities and capacity.
- Generate opportunity hypotheses with evidence, confidence and estimated demand.
- Test demand before encouraging providers to invest.
- Suggest service bundles, group projects or recurring services where appropriate.
- Never imply guaranteed work or income; clearly label hypotheses and pilot results.

### 3.2 Skill-to-Income pathway
- Capture skills and evidence, including informal experience without treating self-assertion as a verified credential.
- Identify gaps between a person's skills and a service's legal/qualification requirements.
- Suggest training or supervised pathways where lawful.
- Help prepare a catalogue, offer, quote template, schedule and customer communication.
- Track time to first qualified lead, first completed mission and first reconciled payment.
- Keep basic access free; never require paid visibility or subscription to access earned work.

### 3.3 Business Launchpad
For a person turning a capability into a small activity:
- activity and country eligibility checklist;
- offer and customer segment definition;
- cost and price calculator with transparent assumptions;
- catalogue, packages, quote and booking workflow;
- customer relationship and planning tools;
- invoice and recordkeeping support where legally appropriate;
- local compliance checkpoints and referral to qualified professionals;
- profitability and cash-flow visibility.
The system must not represent itself as a regulator, lawyer, accountant or licensing authority.

### 3.4 Verified fulfilment network
- Orchestrate single-provider and multi-provider missions.
- Enforce explicit service scope, acceptance criteria, availability, location and schedule.
- Preserve quote/terms snapshots and event provenance.
- Support recurring schedules, replacement and exception management.
- Measure fulfilment reliability, not merely number of matches.
- Use fair and explainable allocation; prevent hidden pay-to-rank or discriminatory matching.

### 3.5 Portable work evidence
- Build a consent-based record of completed work, customer feedback and verified qualifications.
- Distinguish verified platform events, third-party credentials and unverified self-declarations.
- Let providers export or share selected evidence.
- Support correction, contestation, retention limits and deletion rights.
- Never create an irreversible or opaque reputation score.

## 4. Home services as a first-class vertical

PROCHÉLIA DOMICILE is not a generic category. It needs its own service taxonomy, eligibility engine, visit operations, continuity model and safeguarding controls. It can cover ordinary household services and, only where locally authorized and appropriately staffed, regulated assistance. Healthcare acts must not be bundled into ordinary domestic assistance.

Required workflows:
- request intake and scope clarification;
- eligibility and risk classification;
- provider document/qualification/insurance checks;
- beneficiary preferences, consent and accessibility needs;
- quote and schedule;
- visit confirmation and check-in/out where proportionate;
- completion evidence limited to what is necessary;
- incident and safeguarding escalation;
- replacement/continuity coordination;
- invoicing, payment reconciliation and feedback.

A detailed controlled vertical specification is in `PROCHELIA-HOME-SERVICES-COUNTRY-PACKS-AND-SAFEGUARDING-V1.md`.

## 5. Economic model and fairness

Revenue can come from transparent transaction commissions, B2B subscriptions, enterprise workflow services and optional productivity tools. Every monetization route needs a cost and fairness model.

For each transaction calculate and display as applicable:
- customer subtotal, taxes and total;
- provider gross amount and expected net amount, with deductions explained;
- platform fee and platform net revenue;
- payment service provider fees;
- travel, materials, insurance, support, refunds and chargeback costs;
- contribution margin and any subsidies/discounts.

Use integer minor currency units or a deterministic decimal library, explicit currency/rounding rules, immutable quote snapshots and server-authoritative policies. Do not rely on browser-supplied amounts, tax rates, roles or provider eligibility. Do not mix pass-through tax with platform revenue. Do not promise provider income or make prices discriminatory based on protected traits.

North-star metrics:
- median time from provider activation to first qualified lead;
- median time to first completed mission and reconciled payout;
- provider net earnings per working hour after known costs;
- repeat demand and provider retention;
- customer fulfilment, safety and satisfaction;
- mission cancellation, replacement and incident rates;
- platform contribution margin by country/service/cohort;
- share of opportunities that lead to verified work and income;
- complaints, appeals and adverse outcomes.

## 6. International-by-design, locally activated

One shared product core; independently versioned country/region/service packs. Every market is disabled by default until its pack passes legal, payment, privacy/security, operations and QA reviews and receives human approval.

Country pack fields include:
- country/region, languages, RTL support, locale and timezone;
- currencies, tax and invoicing;
- marketplace/operator role and provider status;
- eligible service codes and prohibited/restricted activities;
- qualifications, registration, permits and insurance;
- consumer terms, cancellation and complaint rules;
- payment provider eligibility, settlement and payout restrictions;
- privacy, data residency/transfers and retention;
- support, emergency and safeguarding contacts;
- official source references, review owner, review date and expiry.

Do not infer that a service or payment flow is legal because it works in another country. Algeria and France are separate launch packs; the same principle applies to every future market. Translation is not legal adaptation.

## 7. Launch strategy and validation

Do not launch every category and country at once. Prove a narrow, high-value loop in a selected locality and service family, then expand.

Pilot sequence:
1. Select one geography and one service cluster after legal/operational review.
2. Interview providers, clients and organizations; document current alternatives and unmet needs.
3. Recruit a small, verified cohort; explain demand is not guaranteed.
4. Test real requests, quotes, scheduling, fulfilment, support and payment reconciliation in a controlled environment.
5. Measure time-to-first-income, provider net earnings, customer outcomes and platform contribution margin.
6. Review incidents, complaints, accessibility and fairness.
7. Expand only when predefined safety, quality and unit-economic thresholds are met.

## 8. Non-negotiable product principles

- Mobile-first, accessible, low-bandwidth resilient and multilingual.
- French, Modern Standard Arabic, Algerian Darija and English roadmap; RTL correctness and native review.
- Free basic participation and no pay-to-work gate.
- Clear ranking, commissions, sponsored placement and cancellation terms.
- Consent, privacy, data minimization and user control.
- Human review for consequential decisions.
- No fake reviews, spam, dark patterns or unsupported superiority claims.
- No autonomous legal determinations, safeguarding judgments, money movement or production releases.
- Every capability must have acceptance criteria, tests, owner, telemetry and rollback plan.

## 9. Definition of product success

PROCHÉLIA succeeds when it can demonstrate that it creates additional, safe and sustainable economic opportunities—not merely that it has registrations, listings or AI features. Evidence must show real completed outcomes for clients, fair income for providers and positive sustainable economics for the platform.
