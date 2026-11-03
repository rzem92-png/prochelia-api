# Security regression matrix — finance RBAC / rate limiter

Branch: preprod/security-rate-limit-atomic-v1
Status: test plan created; not executed against Worker/D1 runtime.

## Authorization matrix

| Endpoint | Anonymous | CLIENT | INTERVENANT | SUPPORT | GERANTE | ADMIN | FINANCE |
|---|---:|---:|---:|---:|---:|---:|---:|
| POST /api/finance/entry | 401 | 403 | 403 | 403 | allow | allow | allow |
| POST /api/finance/problem | 401 | allow* | allow* | allow* | allow | allow | allow |
| POST /api/finance/problem/resolve approve=true | 401 | 403 | 403 | 403 | allow | allow | allow |
| POST /api/finance/problem/resolve approve=false | 401 | owner-only | owner-only | owner-only | allow | allow | allow |

*Validate product policy and case ownership/tenant scope.

## Required tests

- Session absent, expired, revoked: 401.
- Unsupported role / missing role: 403.
- Each non-finance role attempts finance-entry creation: 403 and DENIED audit event.
- GERANTE/ADMIN/FINANCE creates valid entry: success + audit record.
- Case owner attempts approve=true: 403 + DENIED audit record.
- Case owner attempts approve=false: only permitted for own case.
- Finance manager approves: success.
- Cross-user case id: 403/404 without data disclosure.
- Concurrent identical requests and replay/idempotency tests.
- SQL/D1 errors: generic response, no stack trace, fail closed.
- Audit payload must not contain session tokens, passwords, payment secrets, raw sensitive metadata.

## Limitations

No local test runner was discovered or invoked in this task. The new checks need to be added to the project's existing test framework and run against a disposable preproduction D1 database. Never test using production data.
