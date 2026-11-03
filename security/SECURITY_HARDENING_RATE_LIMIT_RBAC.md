# Security hardening review — preproduction only

Reviewed source: `src/index.js` on `main` (inspection performed 2026-11-03).
Branch: `preprod/security-rate-limit-atomic-v1`.

## Verified findings

1. Existing `productionRateLimit()` is a read/modify/write sequence (SELECT then UPDATE/INSERT), so concurrent requests can race the quota.
2. Existing limiter skips all non-mutating methods. Expensive GET routes such as finance exports and dashboards therefore do not use this limiter.
3. Existing limiter subject identity is IP+route only; it lacks a per-user/session quota.
4. Existing fallback to `X-Forwarded-For` is unsafe unless the Worker is guaranteed to receive it only from a trusted proxy.
5. `financeRoleAllowed()` includes ordinary roles (CLIENT, INTERVENANT, SUPPORT, etc.) for finance workspace reads; this is acceptable only when each route enforces row ownership.
6. `financeEntryCreate()` currently uses the broad `financeAuth()` and does not separately restrict ledger-entry creation to GERANTE/ADMIN/FINANCE. Treat as a high-priority RBAC defect.
7. `financeProblemResolve()` permits the case owner to set `approve=true`. Case closure is not a payment execution, but approval semantics are misleading and should be separated from manager approval.
8. Current limiter/audit logs are insufficient to claim WAF/anti-DDoS coverage. Cloudflare zone-level WAF, managed rules, rate limiting and DDoS configuration must be independently reviewed.

## Added in this branch

- `src/security-rate-limit-atomic-v1.js`: a standalone atomic D1 UPSERT+RETURNING limiter primitive with a composite key, hashed subject, fail-closed behavior, and no raw IP/session logging.

## Not yet complete / do not release

- The module is not integrated into `src/index.js`.
- No D1 schema migration has been run.
- No Cloudflare settings have been inspected or changed.
- No production, preproduction runtime, concurrency, or integration tests have been executed.
- Do not merge or deploy.

## Required integration and tests

- Install schema in a controlled preproduction migration (never request-time).
- Use atomic UPSERT/RETURNING and verify the composite primary key.
- Add per-IP, per-account, per-session and per-route buckets; avoid double-counting when identities overlap.
- Restrict finance ledger writes to GERANTE/ADMIN/FINANCE with explicit authorization checks.
- Make finance-case approval a distinct manager-only transition.
- Test 401/403/404, cross-user isolation, 429, fail-closed D1 errors, 100+ concurrent requests, and audit redaction.
- Verify Cloudflare WAF/Rate Limiting/DDoS settings manually in the correct zone and confirm Worker origin cannot be bypassed.
