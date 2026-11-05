# SUPRA — Evidence & Validation Operating System v1

## Purpose
SUPRA must support decisions using traceable evidence rather than confident guesses. This specification does not claim that market, financial or legal facts are already verified.

## Evidence record
Each material claim must include claim ID, domain, decision affected, owner, source URL/document/connector event, evidence class, collection date, geography, time period, permission/legal basis, consent reference where applicable, retention, kind (observed/reported/estimated/forecast), sample/method, limitations, contradictions, reviewer and next review date.

A source being available does not prove it is accurate. Metadata checks are distinct from authenticity, representativeness and legal admissibility. SUPRA must never fabricate sources, consent, interviews, invoices, transactions or audits.

## Real data workstreams
### Market demand
- Consent-based interviews/surveys; pilot funnel and actual booking events.
- Public competitor pricing captured with date, geography and source.
- Landing-page/waitlist experiments without deceptive claims.
- Segment by customer, category, region and acquisition channel.
- Measure willingness to pay, completed bookings, repeat demand and cancellations.

### Unit economics and costs
- PSP sandbox first; real PSP reports only after authorization.
- Accounting records, invoices, cloud usage/billing, messaging, support effort, refunds, chargebacks, fraud and acquisition costs.
- Reconcile mission/order/payment/refund/settlement/fees using stable IDs and idempotency keys.
- Separate GMV, platform revenue, taxes, provider earnings, PSP fees and contribution margin. GMV is not platform revenue.
- Every metric includes period, currency, tax basis and cohort. Never label estimates as actuals.

### Retention and value
- Cohort retention for clients, providers, companies and talent.
- Repeat missions, time-to-match, fill rate, cancellations, satisfaction, support resolution and provider earnings net of costs.
- Consent-based, minimized analytics; no dark patterns.
- Analyze liquidity on both sides; a small pilot cannot be extrapolated automatically to national demand.

### Compliance and safety
SUPRA assembles a checklist/evidence dossier and flags missing owners or changed rules. It does not certify compliance or replace counsel, DPO, accountant, regulator or security auditor.
- France/EU topics: consumer information, cancellation/refund, platform status, worker classification, tax/VAT/accounting, payments/PSP, insurance/liability, RGPD, cookies/analytics, DSA and AI Act applicability.
- Applicability depends on facts and requires current official sources and qualified professional review.
- Each conclusion records jurisdiction, date, feature/entity scope and reviewer.
- Do not collect sensitive or unnecessary data to validate demand.

## SUPRA operating cycle
1. Frame question, decision and owner.
2. Produce hypotheses, measurement plan and falsifiable thresholds.
3. Check connector availability, permissions, sources and quality.
4. Collect/request data and preserve provenance, timestamps and consent.
5. Normalize, deduplicate, reconcile and identify missingness/selection bias.
6. Calculate reproducibly; distinguish observed from estimated/forecast.
7. Compare downside/base/upside with sensitivity and uncertainty.
8. Detect contradictions and request review.
9. Recommend GO/HOLD/NO-GO with evidence and unresolved risks.
10. Require human review for legal, financial, pricing, privacy, contract, external communication and launch decisions.
11. Execute only authorized actions; verify outcome independently.
12. Monitor drift, refresh stale evidence, alert owners and audit changes.

## Decision gates
A production gate cannot rely on a user-provided boolean alone. Server-side evidence registry must resolve source references, scope, freshness, owner and review state.
- Market demand: real-user evidence and pilot funnel, not competitor analysis alone.
- Unit economics: positive contribution in conservative scenario after all variable costs.
- Costs: invoices/usage/support reconciled.
- Compliance: reviewed dossier, unresolved questions and accountable sign-off.
- Retention: sufficient cohort size and observation window.
- Security/privacy: threat model, access control, retention, incident response and independent review.
- Owner approval: named human with recorded decision.

Even when gates pass, current helper returns READY_FOR_HUMAN_REVIEW only, never production authorization. It is a policy scaffold, not connected to sources or database persistence yet.

## Sources and consent
Use documented connectors, official/public sources, business-owned records and opted-in research. Respect terms, rate limits, purpose limitation and permissions. No scraping behind login, hidden surveillance, covert microphone capture, private-data resale or unauthorized access. Missing sources must be labelled UNKNOWN/NOT CONNECTED, never guessed.

## Dashboard metrics
- Demand: qualified leads, conversion, completion, fill rate, time-to-match.
- Economics: contribution/mission and segment, CAC, payback, fixed-cost break-even, runway, PSP variance.
- Quality: cancellation/refund/dispute/fraud, complaint resolution, satisfaction.
- Fairness/value: provider net earnings, opportunity distribution, new-talent exposure, total client price.
- Retention: repeat cohorts, active users, churn, time-to-value.
- Compliance/security: evidence freshness, unresolved findings, incidents, consent/retention.
- Confidence: sample, dates, source coverage and uncertainty adjacent to every metric.

## Status labels
VERIFIED (independent source checked within scope); OBSERVED (measured but may not generalize); REPORTED (participant assertion); ESTIMATED (calculated with assumptions); FORECAST (projection); UNKNOWN (insufficient data); CONFLICTED (sources disagree); STALE (past refresh window). Never collapse these into a single green badge.
