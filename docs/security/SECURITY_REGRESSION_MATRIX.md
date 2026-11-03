# PROCHÉLIA Security Regression Test Matrix

Scope: automated static regression checks only. These checks do not constitute a penetration test or security certification.

## Required security properties

- Bootstrap is one-time, secret-protected, and fails closed when the secret is absent.
- Session validation rejects expired, revoked, or inactive sessions.
- Role checks fail closed when the user is absent or the role is not explicitly authorized.
- Cookie-backed state-changing requests require a valid Origin/CSRF protection.
- CORS origins are exact allow-list matches; wildcard origins are forbidden for authenticated flows.
- Backup retention remains non-enforced and must not perform object/database deletion.
- Backup encryption, object checksum verification, and read-after-write validation remain present.
- Production configuration/deployment and D1 migrations are outside this test suite.

## Test philosophy

- Tests inspect narrow, named source sections and fail if anchors disappear (review required after refactors).
- No production credentials, real user data, production endpoints, R2 writes, or D1 writes are permitted.
- Run runtime security tests only against disposable local/test resources.
- Never claim "no vulnerabilities" based on static checks alone.


## Device-binding hardening — required before preproduction sign-off

Current implementation derives `deviceHash` from the authenticated user ID and HTTP `User-Agent` / `sec-ch-ua` headers. These headers are client-controlled and spoofable. The current `trusted_devices` row is therefore not proof of possession of a trusted device; treat this as a security gap, not strong device authentication.

Required remediation (not yet implemented; client compatibility and schema migration need review):

- Issue a cryptographically random device credential only after an authenticated, verified-intervenant flow; use at least 256 bits of entropy.
- Return the raw credential once, over HTTPS, and store only a server-side digest (never log or audit the raw credential).
- Require the credential on both presence and code-verification requests; reject missing, malformed, revoked, expired, or wrong-user credentials.
- Bind the mission presence record to the trusted-device row ID, not a spoofable browser fingerprint.
- Add explicit revocation/rotation, bounded expiry, rate limits, and security audit events that omit secrets.
- Do not silently enroll a device on the presence endpoint. Device enrollment must be a separately authorized flow.
- Add runtime tests for token theft/replay, cross-user use, revoked/expired token, simultaneous requests, and mission ownership.
- Maintain fail-closed behavior until the frontend securely stores and transmits the token and the database schema is reviewed/migrated in preproduction.

**Release gate:** device binding based on browser headers must not be represented as anti-hacking/device authentication. This item blocks a claim of security sign-off for mission presence/code workflows.
