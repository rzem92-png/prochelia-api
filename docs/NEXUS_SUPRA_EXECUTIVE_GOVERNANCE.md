# PROCHÉLIA — NEXUS SUPRA Executive Control Plane

**Status:** architecture target / not yet implemented in full  
**Scope:** PROCHÉLIA France launch, then a separately validated Algeria deployment  
**Principle:** automate operations, never fabricate authority.

## 1. Mission

NEXUS SUPRA is the executive orchestration layer for PROCHÉLIA. It continuously evaluates platform health, business performance, cash and accounting exceptions, legal/compliance obligations, operational service quality, security posture and delivery progress. It converts evidence into prioritized work, executes only pre-authorized low-risk and reversible actions, and escalates decisions requiring a human.

The system must distinguish four states in every dashboard and report:
- **Observed:** supported by a source record, timestamp and provenance.
- **Calculated:** derived from observed data with a reproducible formula and version.
- **Recommended:** proposed by the AI; no side effect has occurred.
- **Executed:** an action actually completed, with actor, authorization, before/after state and result.

An AI-generated statement is never evidence of an underlying transaction or legal fact.

## 2. Executive domains

### Strategy and management
- KPI catalogue with definitions, owners, source tables, refresh time and quality status.
- Gross/net revenue, commission yield, contribution margin per mission, acquisition cost, retention, refund/complaint rate, cash runway and service-level performance.
- Scenario forecasts must label assumptions and uncertainty; never silently turn forecasts into actuals.
- Decision register: question, evidence, options, recommendation, approver, decision, date, review date and outcome.

### Accounting and financial control
The accounting sub-system is a controlled sub-ledger and evidence workspace, not a substitute for an authorized accountant or statutory accounting system until independently reviewed and integrated.

Required capabilities:
1. Sales invoices, credit notes, supplier invoices, expense claims, receipts and supporting documents.
2. Double-entry journal with balanced debit/credit lines, immutable posted entries, correction by linked reversal, unique source-event ID and idempotency key.
3. Chart of accounts and tax codes versioned by legal entity, jurisdiction and effective date.
4. VAT/tax treatment stored as explicit, reviewable classification; uncertain or cross-border cases are routed to a qualified accountant.
5. Bank/PSP statement import, matching, unmatched-item queue, duplicate detection and reconciliation sign-off.
6. Customer/vendor balances, ageing, receivables, payables, commissions, refunds and payout reconciliation.
7. Period close checklist, lock/unlock with dual approval, audit export and evidence retention.
8. Every entry stores source document hash, source system, currency, exchange-rate source/date, tax rule version, preparer, approver and timestamps.
9. No inferred invoice, receipt, bank transaction, VAT amount or journal entry may be posted as fact. OCR/AI extraction remains a draft until validated against the source.
10. Never mutate or delete posted accounting evidence; use a traceable reversal/correction workflow.

France and Algeria must have separate legal-entity configurations, account mappings, tax rules, currency settings, invoice requirements, retention schedules and professional reviews. Do not reuse French VAT/accounting rules for Algeria. Cross-border flows require a documented legal/tax assessment before activation.

### Platform finance and payments
- Maintain strict separation between customer funds, platform revenue, provider balances and payable amounts.
- Use a reviewed PSP adapter; verify signed webhooks against the exact raw body, enforce idempotency and persist provider event IDs.
- Reconcile PSP settlement reports to internal transactions, fees, refunds, chargebacks and bank credits.
- Payouts and refunds require eligibility checks, limits, dual approval and a complete audit trail.
- No real money movement until sandbox end-to-end, legal review, reconciliation, operational controls and explicit release approval all pass.

### Legal and compliance
Maintain a jurisdiction-aware obligations register for corporate, consumer, service-provider, employment/classification, tax, privacy, security, insurance, IP, contract, platform and cross-border requirements. Each obligation must carry:
- jurisdiction and legal entity;
- source URL and retrieval date;
- applicability rationale and confidence;
- owner, due date, evidence and status;
- qualified reviewer and approval date where needed.

NEXUS SUPRA may summarize sources and prepare draft policies/contracts/checklists. It must not represent its output as legal advice, file a declaration, bind the company or decide a regulated classification without qualified human review.

### Technology, security and resilience
- Least privilege, MFA, short-lived sessions, tenant isolation and server-side authorization.
- Explicit secrets management; never log secrets, credentials, full payment details or unnecessary personal data.
- Security event ledger, rate limits, anomaly detection, dependency and supply-chain checks.
- Encrypted backups, independent restore tests, retention and evidence of integrity.
- SLOs, alert routing, incident runbooks, recovery objectives, load tests and change approvals.
- Every automated code/config change must be tested, reviewable and rollback-capable. Production deployment remains a separate human release gate.

### Operations and customer protection
- Mission lifecycle, identity and provider checks, scheduling, completion evidence, disputes, complaints, refunds and service quality.
- Safety escalation, abuse/fraud detection, response SLAs and human case ownership.
- AI may triage and draft; it must not autonomously decide disputed claims, suspend people permanently or issue financial compensation outside approved policy.

## 3. NEXUS SUPRA permission model

Every action must be classified before execution:

| Tier | Examples | Default authority |
|---|---|---|
| A — Read | dashboards, status, reconciliations preview, legal-source monitoring | automatic |
| B — Reversible low-risk | draft a report, classify a document as pending review, open an issue, retry a safe read-only check | automatic with audit |
| C — Controlled write | update catalogue draft, issue a non-financial internal task, prepare accounting draft | explicit role/approval and audit |
| D — Sensitive | post journal, approve invoice, refund, payout, bank change, tax declaration, contract signature, production migration/deploy | human approval; dual control where appropriate |
| E — Prohibited autonomous | bypass access controls, invent evidence, delete posted ledger records, move funds without approval, self-expand permissions | never |

Each action request includes actor/agent identity, tenant/legal entity, purpose, source evidence, policy version, risk score, idempotency key, approval chain, expiry and rollback/compensation plan.

Required controls:
- separation of requester, approver and executor for sensitive actions;
- monetary and daily limits configurable per legal entity;
- break-glass emergency stop with immutable log;
- dry-run/simulation mode;
- replay protection and duplicate prevention;
- policy deny-by-default;
- periodic access review and full audit export.

## 4. Accounting data model (target)

Proposed core entities:
- `legal_entities`, `jurisdictions`, `accounting_periods`
- `chart_of_accounts`, `tax_codes`, `exchange_rates`
- `accounting_documents`, `document_extractions`, `document_approvals`
- `journal_entries`, `journal_lines`, `journal_reversals`
- `bank_accounts`, `bank_statement_imports`, `bank_transactions`, `reconciliations`
- `receivables`, `payables`, `payment_allocations`
- `accounting_audit_events`, `approval_requests`, `integration_sync_runs`

Key invariants:
- A posted journal entry balances to zero per currency and legal entity.
- Posted entries are immutable; correction is a linked reversal and replacement.
- Source-event IDs and idempotency keys are unique in their defined scope.
- A closed period rejects posting unless a controlled reopening is approved and logged.
- All monetary amounts use integer minor units or exact decimal arithmetic; never binary floating-point.
- Every tax/account mapping is versioned and effective-dated.
- Tenant and legal-entity scope is enforced server-side on every read and write.
- Imported data is quarantined until validated; duplicate imports are harmless.

## 5. Integrations

Do not hard-code a bookkeeping vendor before the company selects one. Evaluate an approved accounting provider (for example a French accounting SaaS), the bank feed provider, PSP, invoicing/e-invoicing network and qualified accountant workflow. Each connector requires:
- documented API scopes and data-processing terms;
- least-privilege OAuth/service credentials stored as secrets;
- webhook signature verification and idempotent sync;
- source-to-ledger mapping and reconciliation;
- export/exit plan to avoid vendor lock-in;
- sandbox test, permission review and explicit connection approval.

Never request credentials in chat or commit them to GitHub. Store secrets only through the authorized provider's secret manager.

## 6. H24 operations model

“H24” means an engineered service with scheduled/continuous monitoring, alerting, on-call escalation and documented automation—not a claim that a chat model is thinking continuously between sessions.

Target service:
- event-driven checks for payment/security/availability anomalies;
- scheduled finance, accounting and legal-obligation reconciliations;
- health probes, backup monitoring and recovery verification;
- severity-based alerting with owner and escalation path;
- runbooks, incident timeline, acknowledgement and closure evidence;
- human on-call coverage for incidents that require judgment or legal/financial authority.

A periodic assistant task is not equivalent to a production-grade 24/7 operations centre. Availability targets, monitoring infrastructure, alert delivery, staffing and escalation must be implemented and tested separately.

## 7. Delivery sequence and release gates

1. Inventory existing data, schemas, permissions and integrations; map gaps without changing production.
2. Establish governance, action tiers, legal entities, tenant boundaries and audit events.
3. Build read-only executive dashboards and evidence register.
4. Implement accounting document intake and draft extraction in Preview.
5. Implement double-entry journal, reversals, period locks and accounting tests.
6. Add bank/PSP imports and reconciliation in sandbox; test duplicates, missing events and chargebacks.
7. Add approval workflows, dual control, limits and emergency stop.
8. Add jurisdiction-specific France accounting/tax mapping reviewed by a qualified accountant; then separately assess Algeria.
9. Complete security/privacy/legal review, restore and load tests, and operational drills.
10. Release only after independent evidence review and explicit human approval.

## 8. Current implementation status

This document defines the target architecture; it does not claim these capabilities are already implemented. At the time of writing, the API has security and payment fail-closed fixes under PR review, the latest Preview Worker has been deployed separately from Production, and real PSP payouts remain disabled. The accounting ledger, accounting-provider integration, tax configuration and full Nexus Supra control plane still require implementation and validation.
