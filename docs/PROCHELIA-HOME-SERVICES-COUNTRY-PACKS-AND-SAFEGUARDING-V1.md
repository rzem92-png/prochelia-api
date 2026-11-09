# PROCHÉLIA DOMICILE — service operations, country packs and safeguarding (V1)
Date: 2026-11-09
Status: target specification. No service category is legally enabled by this document.

## 1. Purpose and boundary

PROCHÉLIA DOMICILE is a first-class vertical for household and home-visit services. It must provide reliable request-to-completion coordination while protecting clients, beneficiaries, intervenants and the platform.

It is not a healthcare provider, emergency service, care regulator or substitute for qualified professionals. Clinical acts, nursing, diagnosis, medication administration and other regulated tasks must be excluded unless the exact local legal framework, provider qualification, insurance and operating model have been independently verified and approved.

BGOC is retained as the founder's label; its expansion is not inferred.

## 2. Service taxonomy and eligibility

Every offer must map to a versioned service code. Suggested families (not automatic authorization):
- household cleaning, laundry, ironing and ordinary home organization;
- shopping, errands and non-clinical companionship;
- ordinary home assistance and daily-life support;
- transport/accompaniment where vehicle, driver, passenger and insurance rules permit;
- childcare and child transport, subject to local checks;
- personal assistance and disability-related support, subject to exact local rules;
- gardening, small repairs and household maintenance;
- regulated care/health services: disabled by default and separated from ordinary assistance.

For each country + region + service code, maintain:
- allowed / restricted / prohibited / under-review status;
- provider legal status and registration requirements;
- qualifications, training and experience requirements;
- background-check requirements only where lawful, necessary and proportionate;
- insurance type and coverage evidence;
- premises, equipment and safety requirements;
- client/beneficiary consent and representative authority;
- pricing, tax, invoicing and payment constraints;
- cancellation, consumer information and complaint routes;
- safeguarding and emergency procedure;
- official source references, reviewer, version and expiry.

If a required field is missing, expired, disputed or unverified, do not expose the service for booking or assignment.

## 3. Request-to-fulfilment state machine

Suggested lifecycle:
DRAFT → SUBMITTED → SCOPE_CLARIFICATION → ELIGIBILITY_CHECK → QUOTE_PENDING → QUOTED → CUSTOMER_ACCEPTED → PROVIDER_ASSIGNED → SCHEDULED → EN_ROUTE (optional) → CHECKED_IN (optional) → IN_PROGRESS → COMPLETION_REPORTED → CUSTOMER_CONFIRMATION → RECONCILIATION_PENDING → CLOSED.

Exception states:
CANCELLED, PROVIDER_UNAVAILABLE, REPLACEMENT_REQUIRED, CLIENT_UNAVAILABLE, INCIDENT_REPORTED, SAFEGUARDING_REVIEW, DISPUTED, PAYMENT_REVIEW, EXPIRED.

Transitions must be server-side, role/ownership scoped, idempotent and audited. A browser must not assert that a visit occurred, a beneficiary consented, a provider is qualified or a payment settled. Use trusted server evidence and independent PSP confirmation where relevant. Every state needs allowed actors, preconditions, timeout, retry/recovery path and human escalation.

## 4. Recurring visits and continuity

- Support recurring plans with explicit schedule, service scope, duration and price snapshots.
- Detect overlapping shifts, travel feasibility, rest periods and availability conflicts.
- Respect applicable working-time, employment, subcontracting and travel compensation rules.
- Preserve beneficiary preferences without exposing sensitive details to unnecessary recipients.
- Provide a controlled replacement process when the usual provider is absent.
- Do not substitute an unqualified person for a regulated or sensitive service.
- Notify parties of changes and capture acceptance where required.
- Avoid unsafe pressure on providers to accept last-minute missions.

## 5. Visit safety and safeguarding

Before assignment:
- verify identity and the relevant provider status;
- verify qualifications and insurance for the exact service and territory;
- define permitted tasks and prohibited tasks in plain language;
- obtain informed consent and any required representative authority;
- share only necessary visit details;
- explain how to cancel, report a concern and obtain human support.

During and after a visit:
- provide optional check-in/check-out where proportionate and consented;
- never require invasive surveillance or continuous audio/video;
- allow incident reporting by client, beneficiary, provider or trusted representative;
- preserve evidence securely and restrict access;
- triage urgent safety signals with clear country-specific instructions;
- escalate safeguarding, abuse, exploitation, missing-person, injury or medication concerns to trained human operators and appropriate emergency/local authorities;
- never let an AI model make a final finding of abuse, clinical risk, guilt or liability;
- allow correction, response and appeal for all affected parties.

For emergencies, the interface must instruct users to contact local emergency services immediately; the platform must not delay that action or imply it can dispatch emergency responders unless a validated service exists.

## 6. Sensitive data and access controls

Home address, entry instructions, keys, household routines, health-related details, disability information, children's details and visit schedules are high-risk data.

Controls:
- purpose limitation and minimum necessary collection;
- separate permissions for client, beneficiary, representative, provider, dispatcher, support, safeguarding officer and administrator;
- address and access details revealed only when needed and authorized;
- encryption in transit and at rest, scoped secrets and access logging;
- short retention for temporary access instructions;
- no sensitive details in analytics, URLs, logs, AI prompts or push-notification previews unless strictly necessary and approved;
- no model training on personal/sensitive data without an appropriate lawful basis and explicit governance;
- documented retention, deletion, access, rectification and breach procedures;
- tenant isolation and IDOR/RBAC tests across every endpoint and file.

## 7. Trust, complaints and incident handling

Provide separate flows for:
- ordinary service complaint;
- late/no-show or incomplete visit;
- property damage;
- payment/refund issue;
- qualification or insurance concern;
- harassment, abuse, exploitation or safeguarding incident;
- emergency.

Each case must have severity, timestamps, evidence provenance, assigned human owner, response SLA, parties notified, next steps, decision rationale, appeal path and closure reason. Avoid automated guilt scores or automatic punitive sanctions. Restrict account access only under a documented, proportionate policy with human review except for narrowly preapproved emergency containment.

## 8. Fair provider economics

Quotes must explain customer total and provider expected earnings. Cost model should account for:
- paid service time;
- travel time and travel expenses where applicable;
- materials and equipment;
- taxes and social contributions as relevant;
- insurance;
- payment fees;
- cancellations and no-shows;
- platform commission;
- support and incident handling.

Do not promise a minimum income unless legally and financially guaranteed. Do not hide unpaid travel, expenses or deductions. Ensure commission and ranking do not create pressure to accept unsafe, underpriced or unsuitable visits.

## 9. Country activation gates

Each country pack moves through:
DRAFT → SOURCE_RESEARCHED → LOCAL_LEGAL_REVIEW → INSURANCE_REVIEW → PSP_REVIEW → PRIVACY_SECURITY_REVIEW → SAFEGUARDING_REVIEW → OPERATIONS_REVIEW → QA_PASSED → HUMAN_APPROVED → LIMITED_CANARY → ACTIVE.

Any expired approval, serious incident, legal change, PSP suspension or control failure may move the market/service to SUSPENDED for new orders. Existing cases require a safe continuity/closure plan.

### France pack
Must verify the exact service-personal-services framework and the distinction between declaration, approval, authorization, ordinary assistance and regulated healthcare. Confirm provider status, consumer information, tax-credit representations, insurance, employment/intermediation model, working time and data protection before enabling each service.

### Algeria pack
Must verify the precise activity and status under applicable ANAE/CNRC and other relevant rules; auto-entrepreneur eligibility must not be assumed for every activity. Confirm food/transport/childcare/personal-assistance or other sector-specific authorizations where relevant, insurance, tax/invoicing, consumer terms, payment acquiring and payout eligibility, foreign-exchange/cross-border constraints, privacy and data transfers. Do not infer that a generic registration authorizes regulated care or every home service.

No country pack can be marked approved based only on model-generated research. Record official source URLs, access date, reviewer identity/qualification and written decision.

## 10. Product and operational acceptance criteria

A pilot is not ready unless all applicable tests pass:
- unauthorized/expired provider document blocks assignment;
- a service code disabled in a country cannot be quoted or booked;
- a client cannot access another client's address, schedule or case;
- a provider sees only assigned visit details;
- no role can self-assert verified qualification or completed visit;
- schedule overlap and impossible travel conflicts are rejected or escalated;
- duplicate request/assignment/payment events are idempotent;
- cancellation, no-show, replacement and refund paths are reconciled;
- safeguarding incident is routed to a human owner with a visible SLA;
- AI outage does not prevent emergency instructions or human escalation;
- sensitive data is absent from logs, analytics and notifications;
- audit events are immutable and contain actor, purpose, timestamp and correlation ID;
- users can report, contest and appeal material decisions.

## 11. Rollout

Start with a narrow, non-clinical service cluster and one approved locality. Recruit a small provider cohort and client group. Run supervised pilots, review every incident, measure reliability and provider net earnings, then widen service scope only after explicit approval. Regulated care is a separate future workstream, not an automatic phase-two feature.
