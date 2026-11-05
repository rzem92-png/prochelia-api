# PROCHÉLIA — Auth/RBAC/CSRF security regression matrix

Date: 2026-11-04
Target: isolated preproduction only. No production credentials, PII, or real payments.

This is a test contract, not evidence that these cases already pass. The existing source audit found CSRF/origin, bootstrap race, session revocation, and access-control gaps that must be tested before release.

## Required test layers

- Unit tests for route policy, token validation, role matrix, normalization, and state transitions.
- Worker integration tests against isolated Cloudflare D1 and test-only secrets.
- Browser E2E tests against an isolated preview; never test destructive flows against production.
- Security tests must assert both HTTP response and that database state did not change on rejection.

## Origin / CSRF matrix

| Case | Expected | Database side effect |
|---|---|---|
| Mutating request from exact allowlisted origin, valid session + valid CSRF proof | Accept if RBAC/business checks pass | Only intended write |
| Mutating cookie-auth request from disallowed origin | 403 | None |
| Origin `null` | Deny browser cookie-auth mutation | None |
| Missing Origin with cookie session | Deny by default | None |
| Missing Origin with explicit server-to-server auth route | Accept only if route policy allows it | Intended write |
| Missing/invalid CSRF proof on cookie-auth mutation | 403 | None |
| Valid CSRF token from another session | 403 | None |
| Preflight requests allowed header `X-CSRF-Token` | 204 only; not proof of token validity | None |
| Origin string suffix/prefix spoof (e.g. `allowed.example.attacker`) | Deny | None |
| Preview Pages origin not explicitly allowlisted | Deny | None |
| GET request with attempted state change | 405/403; GET is read-only | None |

## Bootstrap race/replay matrix

- Two simultaneous bootstrap calls with same valid secret: exactly one admin created; the other returns conflict.
- 20 concurrent bootstrap calls: exactly one initial account; no duplicate or orphan admin records.
- Invalid/missing bootstrap token: 401/503 and no user inserted.
- Bootstrap after an existing account: 409, no mutation.
- Bootstrap secret rotation/removal after successful initial setup: endpoint remains unusable.
- Duplicate email / normalization race: unique constraint and deterministic conflict, no duplicate account.

## Authentication / session matrix

- Invalid password, nonexistent account, disabled account, and suspended account: safe error without account enumeration.
- Login rate limit by IP and normalized account: limits apply across case variants and route aliases.
- Logout current session: current token invalidated immediately.
- Password change/reset: all relevant prior sessions invalidated.
- Role downgrade or account suspension: old session cannot retain privileges.
- Session expiration and cookie attributes: HttpOnly, Secure on HTTPS, appropriate SameSite policy, bounded expiry.
- Session fixation: session identifier changes after authentication.
- Token never appears in logs, audit payload, response body, or client-visible errors.

## RBAC / authorization matrix

For every sensitive endpoint, test all role classes (client, intervenant, gerante, unauthenticated) against:
- own resource;
- another user's resource;
- nonexistent resource;
- resource in terminal/locked state.

Expected: 401 unauthenticated, 403 unauthorized, 404 only where deliberately used to avoid enumeration; zero side effects on denial. Do not trust client-supplied role, owner ID, payout recipient, mission participant, or price.

## CI/acceptance conditions

- Every test above must run with isolated test data and a deterministic cleanup strategy.
- D1 race tests must prove the final database state, not merely response codes.
- CI output must include pass/fail counts and commit SHA.
- Any flaky race test is a release blocker until explained.
- This matrix does not authorize production deploy, D1 migration, real email/SMS/WhatsApp, or PSP charges.

## Release status

**Not yet passed.** These are mandatory acceptance tests based on current source-level findings. A successful unit CI run does not satisfy this matrix.
