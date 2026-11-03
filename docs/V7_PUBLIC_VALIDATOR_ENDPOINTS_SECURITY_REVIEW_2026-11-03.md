# V7 public validator endpoints — security review

**Branch:** `fix/nexus-minimum-viable-quote-gate`  
**Review date:** 2026-11-03  
**Scope:** static source inspection of `src/v7-routes.js` and `src/v7.js`. No live API, D1, or production access.

## Key finding

The V7 route module exposes multiple `POST /api/v7/check/*` routes that accept client-supplied JSON and run local validation. These may be useful as convenience validators, but they are **not authorization controls** and their responses must never be treated as trusted server-side decisions.

The same applies to:
- `/api/v7/check/permissions`: a caller can submit a role/permission-shaped object; its output is not proof of the caller's identity or entitlements.
- `/api/v7/check/mission-transition`: caller-supplied current/next status is not evidence that the mission may transition.
- `/api/v7/check/availability` and `/api/v7/check/conflict`: input-only checks do not reserve a time slot or establish transactional exclusivity.
- `/api/v7/check/pricing`, `/api/v7/finance/calculate`, and `/api/v7/strategy/indicators`: client-provided numbers are simulations, not authoritative price, revenue, or settlement records.
- `/api/v7/security/idempotency`: checking a submitted key is not a durable atomic idempotency claim; must not protect a write by itself.
- `/api/v7/security/audit`: the route creates a client-shaped audit object in memory and returns it; it is not a durable audit trail and actor fields must not be trusted.

## Verified source behavior

- Routes parse JSON directly and call pure helpers in `src/v7.js`.
- The V7 route module does not itself authenticate the actor for these validation endpoints.
- The payment-check endpoint is deliberately non-authoritative and returns HTTP 409.
- `v7AuditEvent` accepts actor/action/entity/detail fields from its input and returns a generated object; this does not constitute persisted or authenticated audit evidence.

## Required controls before any production use

1. Treat all validator responses as advisory only.
2. Enforce authentication and route-specific RBAC/ownership at the authoritative write endpoint.
3. Derive actor ID/role from the verified server session, never request JSON.
4. Revalidate mission status, availability, price, wallet/ledger, and payment state inside the authoritative operation.
5. Use database constraints/transactions for collision prevention and durable idempotency.
6. Persist audit events server-side with actor/session provenance and redaction.
7. Apply request-body size limits, strict schema validation, rate limits, and consistent error handling.
8. Add integration tests for unauthenticated requests, forged actor/role, IDOR, replay, race/concurrency, and forged client totals.

## Status

This is a static security finding and design guardrail. It does not claim a vulnerability exploit was run or that all V7 routes are reachable through the Worker router. Confirm route registration and global middleware separately. No code behavior, database, or production deployment was changed.
