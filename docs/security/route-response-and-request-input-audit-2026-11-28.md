# Route response-security and request-input audit — 2026-11-28

## Scope and evidence
Reviewed `src/index.js` and `src/v7-routes.js` on main commit `d54e20f81407228e56b9580053f212905200089d`, plus V7 regression tests.

## Finding RSP-01 — Early-return routes bypassed the response-header decorator
The core handler returns V7, finance-workspace, and commercial-recruitment responses before reaching its final response-header decorator. The outer production-safety wrapper previously passed those responses through unchanged. This made security headers dependent on route path rather than universal.

### Correction
- Added `applySecurityHeaders(response, request)` as a shared response decorator.
- The outer safety wrapper applies it to successful route responses, strict audit responses, rate-limit responses, preflight denials, database-unavailable responses, and caught errors.
- Added an integration regression using `GET /api/v7/status` and assertions for HSTS, nosniff, frame denial, referrer policy, permissions policy, and no-store.
- Added a preservation test for response status and application headers (e.g. Retry-After).

## Finding RSP-02 — Request payload size and schema limits are not uniformly enforced in the V7 route layer
The inspected V7 routes parse JSON directly with `request.json()` and use route-specific validators; no shared request-body byte limit or strict schema layer was identified in this inspected route module. Cloudflare platform limits are not a substitute for application-level validation.

### Required follow-up
- Define endpoint-specific maximum body sizes (smaller for simple validators; larger only for explicitly supported upload/complex payload paths).
- Reject oversized requests before parsing, with deterministic 413 response.
- Validate JSON content type and schema; reject unknown fields where appropriate.
- Add malformed JSON, oversize, deeply nested, and type-confusion tests.
- Ensure document/file upload routes use streaming and explicit storage policy rather than JSON body exceptions.

## Finding RSP-03 — Rate limiting is global for mutating requests but not demonstrated as endpoint-specific abuse protection for all read/expensive operations
The production wrapper invokes the persistent limiter for mutating requests. The configured general/sensitive path buckets are documented in source. This does not establish protection for high-cost read operations or expensive computation endpoints.

### Required follow-up
- Inventory every endpoint by cost, sensitivity, and authentication.
- Apply independent quotas to login, verification, password reset, payments, complaints, jobs, AI/copilot, search, document verification, and computational validators.
- Use an atomic counter/lease primitive; review current D1 update/insert concurrency behavior.
- Add burst, concurrent, spoofed-IP-header, and bucket-isolation tests. Prefer trusted Cloudflare connection metadata; never trust arbitrary forwarded IP without proxy boundary validation.

## Status
RSP-01 code fix and tests are in this draft branch. RSP-02/RSP-03 remain audit findings. Documentation only for the latter; no production deployment, secrets, migration, or data writes.
