# PROCHÉLIA NEXUS Marketplace & Opportunities — Blueprint v1

Status: architecture proposal / implementation planning. Not production-ready.
Scope: talent profiles, showcase, service offers, booking requests, opportunities, payouts, and SUPRA transversal orchestration.

## Product principles

- One PROCHÉLIA ecosystem, not disconnected apps: Services, Nexus Talent, Showcase, Opportunities, Business and SUPRA.
- Free baseline talent profile and showcase; monetization must charge for value delivered, not visibility by default.
- Adults and minors have distinct eligibility, consent, visibility, messaging, contracts, and payment policies. Minor accounts are not enabled for paid marketplace activity until French legal review and safeguards are approved.
- SUPRA recommends and coordinates; it never overrides role permissions, legal constraints, payment controls, or explicit human approval.
- No public exposure of exact home address, private phone/email, identity documents, payout data, or sensitive profile fields.
- No direct unmoderated adult-minor messaging. Guardian/authorized adult controls and restricted contact flow are mandatory for any future minor profile mode.

## Core journeys

1. Talent onboarding: category -> profile -> portfolio/showcase -> skills/experience -> location radius (coarse only) -> availability -> offers -> moderation/verification.
2. Client discovery: natural-language search -> ranked eligible results -> compare offers -> request quote/booking -> confirmation -> payment provider flow -> completion -> review/dispute.
3. Talent operations: quote/accept/decline -> calendar conflict check -> booking status -> cancellation rules -> receipt/invoice workflow -> earnings and payout status.
4. Business opportunity: organization publishes a structured opportunity -> eligibility and budget -> talent applications -> shortlist -> human selection -> contract/payment workflow.
5. SUPRA assistant: explain recommendations, draft quote/messages, detect booking/payment/calendar conflicts, suggest resolution options, execute only reversible low-risk actions within permissions and audit all actions.

## Suggested domain boundaries (avoid duplicating existing auth/payment tables)

- talent_profiles: user_id (unique FK), public_slug, headline, bio, categories, skill_tags, verification_state, visibility_state, created_at, updated_at.
- talent_portfolio_items: id, talent_user_id, media_asset_id/reference, type, title, caption, rights_attestation, moderation_state, sort_order, created_at.
- talent_offers: id, talent_user_id, category, title, description, duration_minutes, price_minor, currency, travel_policy, eligibility_state, active, created_at, updated_at.
- talent_availability: id, talent_user_id, start_at, end_at, timezone, status, source, version.
- opportunity_posts: id, organization_user_id, title, description, category, budget_min_minor, budget_max_minor, currency, location_mode, location_coarse, eligibility_rules, status, created_at.
- opportunity_applications: id, opportunity_id, talent_user_id, status, submitted_at, unique(opportunity_id, talent_user_id).
- booking_requests: id, offer_id, client_user_id, talent_user_id, starts_at, ends_at, timezone, quote_minor, currency, status, idempotency_key, version, created_at.
- booking_events: append-only audit events for state transitions (actor, action, previous/new state, reason, request_id, timestamp).
- disputes: id, booking_id, opened_by, reason_code, status, resolution, resolved_by, timestamps.
- supra_tasks: id, actor_user_id, task_type, risk_level, input_ref, status, proposed_action, approved_by, execution_ref, idempotency_key, created_at, completed_at.
- supra_audit_events: append-only record of decisions, evidence references, policy version, execution outcome, human override.
- Do not create or run migrations until existing D1 schema and all pending migration branches have been reconciled. Prefer additive migrations with rollback/restore proof.

## State machines

Booking: draft -> requested -> quoted (optional) -> accepted -> payment_pending -> confirmed -> in_progress -> completed.
Terminal alternatives: declined, cancelled, expired, disputed, refunded (refund state should remain linked to payment ledger; do not rewrite history).
- Every transition validates actor/role, current state, time constraints, availability, eligibility and idempotency.
- Atomic reservation/locking is required to prevent overlapping bookings and race conditions.
- Payment provider webhooks are authenticated, deduplicated, replay-safe and reconciled to immutable ledger records.
- A booking is not marked paid from client-side confirmation.

Opportunity: draft -> published -> applications_open -> shortlisted -> selected -> contract_pending -> active -> completed; with cancelled/closed alternatives.
- Selection and contracts require authorized human action; SUPRA may rank/explain but must not autonomously discriminate or make final hiring/selection decisions.

## SUPRA autonomy and conflict resolution

Risk tiers:
- L0 informational: summarize, explain, recommend; no mutation.
- L1 low-risk reversible: create drafts, reminders, suggested schedule blocks; execute only when user enabled the action and permissions are checked.
- L2 consequential: booking acceptance, price changes, cancellations with fees, refunds, payouts, public posts, contract changes: explicit confirmation required.
- L3 sensitive/high-risk: legal status, minor eligibility, disputes, identity verification overrides, financial/legal decisions, production data changes: human review required; SUPRA must not auto-approve.

Conflict resolution order:
1. Safety/legal/age/consent constraints.
2. Authentication, ownership, role/RBAC and organization boundaries.
3. Payment/ledger integrity and idempotency.
4. Existing confirmed commitments and cancellation policy.
5. Availability/timezone/resource collision.
6. User preferences and business rules.
7. Optimization (cost, convenience, ranking).

If no safe deterministic resolution exists: freeze only the affected action, explain why, present choices, escalate to authorized human, preserve audit trail. Never silently cancel, charge, refund, expose data, or alter contracts.

## API proposal (prefix and naming to align with existing routing conventions after code audit)

- GET /api/nexus/talent/me
- PATCH /api/nexus/talent/me
- GET /api/nexus/talents (public safe projection; filters/pagination)
- POST /api/nexus/portfolio
- PATCH /api/nexus/portfolio/:id
- POST /api/nexus/offers
- GET /api/nexus/offers
- POST /api/nexus/bookings
- GET /api/nexus/bookings
- POST /api/nexus/bookings/:id/quote
- POST /api/nexus/bookings/:id/accept
- POST /api/nexus/bookings/:id/cancel
- POST /api/nexus/opportunities
- POST /api/nexus/opportunities/:id/applications
- GET /api/nexus/opportunities
- POST /api/supra/tasks (create a task/draft; never privileged arbitrary execution)
- GET /api/supra/tasks/:id
- POST /api/supra/tasks/:id/approve (human approval for gated actions)
- POST /api/supra/tasks/:id/execute (server-side policy check + idempotency + audit)

Routes are proposals, not implemented or guaranteed. Align with existing V14/V7 route handlers, auth/session middleware, error envelope and API versioning before coding.

## Revenue model hypotheses (validate with user research and legal/accounting review)

- Booking/service fee or disclosed commission on completed adult-provider transactions.
- Business subscription for opportunity publishing, team workflows and analytics.
- Optional paid tools for adult professionals (portfolio/CRM/marketing); never pay-to-be-visible by default.
- Events/booking services and vetted partner offerings.
- Enterprise licensing only after product-market fit.
- Avoid revenue sharing or paid work for minors until legal model is specifically approved.

## Security, privacy and abuse controls

- Least-privilege RBAC and object ownership for every endpoint.
- Public profile projection allowlist; no raw user row serialization.
- Media upload limits, MIME/content validation, malware scanning, rights declaration, moderation/report/block.
- Rate limits, spam/abuse controls, anti-scraping, audit trails and retention policy.
- GDPR privacy by design: purpose limitation, data minimization, consent where required, deletion/export workflows, retention rules and DPIA assessment where applicable.
- Minor protection is a separate safety gate, not merely a profile flag.
- No algorithmic ranking based on protected/sensitive traits. Explain ranking factors and allow correction/appeal.

## Test plan and release gates

Unit tests:
- validation and state-machine transition matrix
- RBAC/ownership for each role and endpoint
- minor restrictions / guardian permissions / public projection
- timezone, daylight-saving, overlapping availability and booking race cases
- idempotency same-key replay and different-owner attempts
- webhook replay, duplicate event, refund concurrency and ledger reconciliation
- SUPRA risk tiers, approval bypass attempts, audit completeness and safe fallback
- XSS/content validation, media rights, privacy projection and rate limits

Integration tests (preview only):
- D1 preview schema/migration on disposable database
- API + session/CORS + frontend booking flow
- sandbox payment onboarding, authorization/capture/refund/payout flows
- concurrent booking reservation and webhook delivery
- restore from backup and integrity checks

Release gates:
1. Existing production and preview schema read-only inventory; no unreviewed migration.
2. Unit/contract tests pass.
3. Preview integration and browser E2E pass.
4. Security/privacy review, legal review of marketplace and minor-related flows.
5. Payment sandbox reconciliation and payout/refund tests pass.
6. Observability, alerting, backup/restore and rollback are demonstrated.
7. Human release approval and staged canary.
8. Production rollout only with separately confirmed deployment authorization.

## Non-goals for initial MVP

- No TikTok-style infinite feed or unbounded video hosting.
- No automatic talent contract signing, legal eligibility decision, payout release, dispute verdict or refund.
- No minor paid gigs until legally reviewed.
- No production D1 migration or production deployment as part of this blueprint commit.

## Acceptance criteria for first adult-only vertical slice

- A verified eligible adult can create a profile, portfolio and offer.
- A client can search, request and confirm a booking through sandbox payments.
- Ownership and RBAC prevent cross-user reads/writes.
- Conflicting slots cannot be double-booked under concurrency.
- Booking/payment operations are idempotent and auditable.
- SUPRA can draft quote/resolution and detect conflicts; gated actions require approval.
- CI and browser tests pass; no production rollout until release gates are met.
