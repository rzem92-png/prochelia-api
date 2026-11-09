# PROCHÉLIA — country pack schema and activation gates (V1)
Date: 2026-11-09
Status: configuration and governance specification. No country is activated.

## 1. Design objective

A country pack is a versioned, reviewable configuration object for one country (and where necessary region), service code and operating role. It prevents a global product default from silently becoming a local legal or operational permission.

Country packs are data plus human approvals. They are not free-form prompts and must not be authored or activated solely by an LLM.

## 2. Canonical record

Required logical fields:
- `country_code`: ISO 3166-1 alpha-2.
- `region_code`: optional locally defined subdivision.
- `pack_version`: immutable semantic or monotonic version.
- `status`: DRAFT, RESEARCH, LEGAL_REVIEW, PSP_REVIEW, PRIVACY_SECURITY_REVIEW, INSURANCE_REVIEW, SAFEGUARDING_REVIEW, OPERATIONS_REVIEW, QA_PASSED, HUMAN_APPROVED, CANARY, ACTIVE, SUSPENDED, RETIRED.
- `service_codes[]`: explicit service catalogue identifiers; each service has independent status.
- `languages[]`, `default_language`, `rtl_languages[]`.
- `currency_codes[]`, `timezone`, locale/date/number formats.
- `tax_invoice_policy_ref`, `consumer_terms_ref`, `provider_terms_ref`.
- `provider_eligibility_policy_ref`, `qualification_policy_ref`, `insurance_policy_ref`.
- `payment_provider_refs[]`, supported payment methods and payout capabilities.
- `privacy_policy_ref`, data residency/transfer rules, retention schedule.
- `support_hours`, escalation contacts and emergency guidance references.
- `official_sources[]`: source URL, authority, jurisdiction, access date, relevant section, reviewer and review date.
- `approvals[]`: approver identity/role, decision, scope, rationale, evidence hash, timestamp and expiry.
- `change_log[]`: old/new version, actor, reason, linked review and rollback target.

Sensitive credentials and personal data must never be stored in the country pack. Store secret references only, in the secret manager.

## 3. Service-code record

Each service code has:
- stable identifier and plain-language label;
- country/region applicability;
- allowed / restricted / prohibited / under-review state;
- task inclusions and explicit exclusions;
- provider status and qualification requirements;
- registration, permit and declaration requirements;
- insurance coverage requirements;
- customer eligibility/consent and safeguarding conditions;
- pricing/tax/invoicing rules;
- cancellation/refund/complaint policy;
- data classification and retention;
- emergency escalation procedure;
- source evidence, reviewer, version and expiry.

A missing, expired, contradictory or unreviewed required attribute makes the service non-bookable. The server is authoritative; client UI flags cannot override this state.

## 4. State machine and activation

DRAFT → RESEARCH → LEGAL_REVIEW → PSP_REVIEW → PRIVACY_SECURITY_REVIEW → INSURANCE_REVIEW → SAFEGUARDING_REVIEW → OPERATIONS_REVIEW → QA_PASSED → HUMAN_APPROVED → CANARY → ACTIVE.

Any critical change, expired approval, incident, payment suspension, legal uncertainty or control failure may transition ACTIVE/CANARY to SUSPENDED. SUSPENDED blocks new bookings while preserving safe handling of existing commitments.

Activation must bind to:
- exact country pack version and hash;
- exact service-code list and geographic scope;
- named accountable human approver;
- start time, review date and expiry;
- release commit and tested environment;
- rollback/stop procedure.

SUPRA can compile evidence and recommend transitions but cannot perform HUMAN_APPROVED or ACTIVE transitions.

## 5. Runtime enforcement

At request, quote, assignment, visit and payment stages:
1. Resolve the authenticated actor and tenant on the server.
2. Resolve the resource country/region and service code from trusted stored data.
3. Load the active pack and exact service policy version.
4. Verify pack status, approval expiry and service eligibility.
5. Verify provider status, required qualifications and insurance.
6. Apply consumer, price, tax, payment and data rules.
7. Record the policy version and decision evidence with the transaction.
8. Fail closed on missing or unavailable policy data.

Never trust a browser-provided country approval, provider verification flag, tax amount, role or PSP status.

## 6. Localization contract

- Language choice is explicit and persists per user, with safe fallback.
- Arabic UI supports true RTL layout, not merely translated strings.
- Search normalizes Arabic variants carefully while preserving original text.
- Store canonical timestamps in UTC; display using the country's timezone.
- Store money as integer minor units with explicit currency; never infer currency from a symbol.
- Format addresses, names, phone numbers, dates and decimal separators per locale.
- Preserve the authoritative original quote/contract version; translations are convenience views unless separately accepted under a validated legal process.
- Native linguistic and cultural review required before public launch.

## 7. Country pack governance

Each pack must have:
- accountable product owner;
- qualified local legal reviewer;
- payment/finance reviewer;
- privacy/security reviewer;
- insurance/safeguarding reviewer where relevant;
- operations/support owner;
- QA owner;
- executive approver.

Review intervals and event-driven refresh triggers must be defined. Official-source changes, court/regulatory updates, PSP policy changes, insurance expiry and serious incidents trigger re-review.

## 8. Data integrity and tests

- Unique key: country + region + pack version.
- Immutable approved versions; changes create a new version.
- Foreign keys from service/mission/quote records to policy version.
- Audit approvals and activation events append-only.
- Concurrency-safe activation and suspension.
- Tests: unknown country, unknown service, expired approval, conflicting sources, suspended pack, provider document expiry, wrong region, spoofed client fields, tenant crossing, currency mismatch, locale/RTL regressions, stale cache and policy unavailability.
- Historical transactions retain the policy/quote snapshot that applied when accepted.

## 9. Initial rollout configuration intent

- France: candidate first pilot pack, still DRAFT until each service and operating model is reviewed and approved.
- Algeria: candidate parallel discovery pack, DRAFT; payment and activity eligibility must be independently verified.
- All other countries: no default activation. Start from DRAFT and use the same gates.

No generic global setting may override a stricter country/service rule.
