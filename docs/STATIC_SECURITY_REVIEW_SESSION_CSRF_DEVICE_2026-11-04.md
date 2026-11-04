# Focused static review — session cookie, CSRF, schema-on-request & device trust
Date: 2026-11-04
Source reviewed: `src/index.js` on `prelaunch/v14.5.7-consolidation-audit` (blob SHA `8eb93f69d25dcddab1118b9ce3513b56746f51f9`).
Type: **static source inspection only**. No runtime exploit/test performed.

## Finding SEC-01 — Session cookie uses SameSite=None
Observed:
`sessionCookie()` emits `HttpOnly; Secure; SameSite=None`.
This permits cross-site cookie attachment in browsers (subject to browser policies). If frontend/API intentionally operate cross-site, this may be needed for cookies, but it increases CSRF exposure. HttpOnly does not prevent CSRF.

Required verification / mitigation:
- Confirm exact frontend and API origins and browser deployment model.
- If same-site deployment is feasible, prefer `SameSite=Lax` or `Strict`.
- If cross-site is required, enforce CSRF protection for every cookie-authenticated state-changing route: synchronizer/double-submit token with appropriate cryptographic binding, strict Origin/Referer allowlist, content-type restrictions, and no state changes on GET. SameSite remains defense-in-depth, not the only control.
- Verify CORS does not reflect arbitrary origins and credentialed CORS is exact allowlist only.
- Add browser tests for cross-site form POST, fetch with credentials, missing/invalid CSRF token, valid token, origin spoofing, and Safari/iOS behavior.
- Rotate session token after login/privilege change; revoke prior sessions on password reset/identity change and provide user session revocation.
- Do not change cookie attributes until cross-origin design is confirmed; test on preview first.

Severity: **potentially high** if any state-changing route is cookie-authenticated and lacks CSRF defenses. Not yet confirmed exploitable.

## Finding SEC-02 — DDL helpers appear callable from request paths
Observed in source: `ensureSecuritySchema(env)` contains CREATE TABLE/INDEX statements. A caller in `securityIdentityStart` invokes it after role auth. This is not unauthenticated in this path, but DDL at request time can create concurrency, permission, latency and operational risks. Audit all callers and ensure no route calls schema creation before auth or on production requests.

Required:
- Replace request-time DDL with reviewed, explicit migration artifacts.
- Migration version ledger, checksums, preflight, backup/restore, staging rehearsal, rollback strategy.
- Do not run migrations from HTTP request handlers.

## Finding SEC-03 — “trusted device” fingerprint is not identity proof
Observed:
`deviceHash()` hashes user ID + User-Agent + sec-ch-ua. These values can be spoofed and are not a strong device identity.
Required:
- Treat as a weak risk signal only, never as authentication/authorization or proof of identity.
- Prefer revocable random server-issued device token stored securely; bind/rotate/revoke and require step-up auth for sensitive actions.
- Document privacy/retention and avoid fingerprinting beyond necessary scope.

## Finding SEC-04 — Six-digit mission codes use modulo reduction
Observed:
`securityCode()` uses a random 32-bit number modulo 1,000,000. The bias is negligible for practical use but avoidable.
Required:
- Use rejection sampling or a cryptographic random integer helper with unbiased range generation.
- Enforce rate limit/lockout, expiry, mission/actor/device binding, one-time use and constant-time verification.
- Ensure the code itself is never logged and only a hash is stored.
- Review code entropy and anti-bruteforce thresholds based on real rate limits.

## Required test evidence
- CSRF cross-origin test suite and Safari/iOS E2E.
- Route inventory: all state-changing methods, auth/session middleware, CSRF coverage, ownership validation.
- DDL-call inventory and proof all migrations are explicit/manual.
- Security-code replay, brute force, expiry, one-time-use and concurrent-use tests.
- Device trust spoofing test proving spoofed UA cannot bypass identity/step-up.

## Release impact
Do not mark session/mission security production-ready until SEC-01 through SEC-04 are resolved or formally risk-accepted by the owner/security reviewer. This static review does not certify exploitability or absence of other vulnerabilities.
