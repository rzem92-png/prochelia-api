# Review finding — V7 bounded JSON guard authentication order and test boundary

Date: 2026-11-28
Related: PR #492

## Finding 1 — body is consumed before authentication
The proposed change in PR #492 invokes `boundedJsonRequest(request, 65536)` before `getSessionUser(request, env)`. This means unauthenticated callers can trigger streamed body reading, allocation and JSON parsing up to the configured limit before the route's authentication/authorization decision. The cap bounds exposure but does not make authentication-first ordering unnecessary.

**Recommendation:** Resolve session/authentication first for routes requiring authentication; enforce route-specific access policy before body parsing wherever the route contract permits. For intentionally public validators, apply edge/WAF/rate-limit protection and a smaller endpoint-specific cap, and document the public status explicitly. Do not accidentally make public checks private or change API semantics.

## Finding 2 — helper tests are not Worker-entry tests
The PR tests call `boundedJsonRequest` directly. They do not verify routing, auth-before-body behavior, route-specific policy, securityOriginAllowed, or the complete Worker request/response path.

**Required tests:** through the exported Worker handler (or equivalent integration harness):
- unauthenticated protected V7 route rejects without consuming/parsing the body;
- authenticated route with wrong media type -> 415;
- malformed JSON -> 400;
- non-object JSON -> 400;
- streamed oversized body with missing/incorrect Content-Length -> 413;
- valid body reaches the route and preserves method, URL and headers;
- public route exceptions are explicitly tested;
- response security headers remain present on early guard responses.

## Finding 3 — schema validation is still missing
The guard validates only JSON syntax and top-level object shape. Per-route required fields, types, unknown fields, bounds, nesting, and semantic validation remain delegated to handlers. This is an input-size mitigation, not a complete schema/security validation.

## Finding 4 — early responses bypass the normal security-header wrapper
In the current handler structure, V7 responses return before the response-header normalization wrapper applied to `handleV139` responses. Guard-generated 400/413/415 responses likewise return early. Ensure all responses—including authentication, route errors and parser errors—pass through a single response hardening layer.

## Suggested priority
P0/P1 before production: auth order, uniform response hardening, route-entry tests, and per-route schema contract. Keep PR #492 Draft until evidence is complete.

## Safety
Review/documentation only. No production change, merge, secrets, database, migrations or financial actions.
