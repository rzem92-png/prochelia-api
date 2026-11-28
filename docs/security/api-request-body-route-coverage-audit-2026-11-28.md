# API request-body route coverage audit — 2026-11-28

## Purpose
Follow up on the response-header audit (#491) and bounded V7 JSON input guard (#492). This is a source-tree inventory, not a complete dynamic route test or penetration test.

## Evidence snapshot
Inspected `src/index.js` on `main` (3,697 lines at inspection). The shared `readJson(request)` helper directly calls `request.json()` and returns null on parse failure; it has no byte cap, content-type enforcement, schema enforcement, or structured parse error. A source scan found **40 body-consumption call sites** (including the helper itself) using `readJson`, `request.text()`, or related request-body parsing.

The new #492 draft guards POST requests under `/api/v7/` with a 65,536-byte streamed limit and JSON media-type/object validation. That does **not** protect other route families.

## Route-family coverage requiring a shared guard or explicit exception
- Authentication/bootstrap: login, bootstrap and related credential/profile inputs.
- Identity and mission security: identity start/approval, mission preparation, presence, code verification/resend/client-code.
- Operational and case workflows: cases, approvals, execution, outbox processing, quality, loyalty, client scoring, settings/phase, capacity and finance forecasts.
- AI/copilot and background processing: validators, job processing and operational summaries.
- Commercial/recruitment: recruitment requests, sales kits, generated plans and related payload handlers.
- Finance/accounting and complaints: workspace cases, solutions, status/review and complaint submissions.
- System/backup administration: backup run, maintenance/admin controls.
- Webhook/event intake: raw body parsing path around `request.text()`; requires provider-native signature verification, freshness, binding, strict size limits and atomic/idempotent event processing (tracked in #487).

This list is based on route/function names and observed body reads. It is not proof that every endpoint is reachable or vulnerable.

## Required common contract (proposed; not implemented here)
1. Route/method allowlist and authentication/authorization before parsing wherever possible.
2. Enforce media type for JSON routes; reject unsupported media with 415.
3. Stream-count bytes and enforce endpoint-family maximums; never trust Content-Length alone.
4. Return deterministic 400 for malformed UTF-8/JSON and schema/type violations, 413 for over-limit, 415 for wrong media.
5. Strict per-route schema: allowlist fields, reject unknown fields where appropriate, bound strings/arrays/nesting/number ranges, normalize before business logic.
6. For high-cost AI/search/report routes, enforce separate quotas, concurrency limits and deadlines; body limits alone are insufficient.
7. For mutations, require trusted session, tenant resolution/membership and route-level role/ownership checks; idempotency and append-only audit for state changes.
8. For webhook routes, provider signature/freshness/account binding, bounded raw-body capture, replay protection, and atomic claim/complete/reconcile.
9. Test through the Worker entry point, not only direct helper calls: every route-family representative, malformed media/JSON, streamed oversize, schema fuzzing, auth bypass, cross-tenant IDs, concurrency and replay.
10. Maintain an exception register for routes that intentionally accept non-JSON bodies, with owner, maximum size and tests.

## Priority sequence
- P0: webhook raw-body cap + provider verification/atomic event processing; tenant authorization boundary (#488); uniform response headers (#491); V7 cap (#492).
- P1: shared bounded parser and route-family schema inventory; auth/bootstrap payload limits; expensive AI/operations quotas; endpoint-level tenant/role/ownership tests.
- P2: fuzz/property tests, concurrency/idempotency, privacy-safe observability and exception register.

## Safety
Documentation only. No runtime behavior, secret, database, migration, production deployment, financial action or real data changed. Draft PR; human review required.
