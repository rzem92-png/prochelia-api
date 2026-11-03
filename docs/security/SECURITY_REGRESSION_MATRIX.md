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
