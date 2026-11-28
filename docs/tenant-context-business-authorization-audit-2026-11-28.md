# Tenant context versus business authorization audit — 2026-11-28

## Scope
Inspected tenant-context changes at PR #477 head `fc982d62d3be2ef3f6bdd211e28d325c9c564249`:
- `src/tenant-context.js`
- `src/index.js` tenant-context route wiring
- `tests/tenant-context.test.mjs`
- `src/accounting-api.js`

## Controls present
- Tenant listing is constrained by authenticated session, matching user, unexpired session, ACTIVE membership and ACTIVE tenant.
- Tenant selection is constrained by session ID, user ID, active membership, active tenant.
- Selection response does not grant business authority; comments explicitly say selected workspace is request context only.
- Tests cover mismatch, unknown/expired session, suspended/revoked tenant membership, non-member selection, malformed and oversized bodies.

## Audit gap / release blocker
### T-01 — Tenant selection is not evidence of authorization for business routes
The tenant-context module persists a selected tenant per session. The inspected `src/index.js` does not show a shared request authorization middleware that resolves this selected tenant into a verified tenant membership and enforces tenant scope on every business operation. The accounting module's role helper uses `auth.tenant.role`, but the inspected main index does not reference/import `accounting-api.js` or populate `auth.tenant` in the visible request flow.

This is a scoped source-tree finding, not proof that every route is vulnerable or that no external middleware exists. It means tenant-context selection cannot be accepted as a security boundary or release evidence.

## Required implementation and tests before multi-tenant release
1. Central tenant resolver on every tenant-scoped request: authenticated session -> selected tenant -> active tenant -> active membership -> server-derived tenant role/permissions.
2. Tenant ID must be taken from server-validated context, never trusted solely from request body/path/header.
3. Object ownership checks must combine object ID and tenant ID in the same query/update; test IDOR across two tenants.
4. Every route family (missions, clients, intervenants, files, messaging, accounting, reports, support, admin) must be inventoried and classified tenant-scoped/global.
5. Deny missing, suspended, revoked, mismatched, stale or ambiguous context; never fall back to a default tenant.
6. Add negative cross-tenant tests for read/write/delete/export, file access, payment and accounting; test tenant switching/session fixation/concurrent context changes.
7. Audit logs should record authenticated actor, tenant, action and outcome with privacy-safe metadata.

## Release decision
**NO-GO for tenant-scoped business release until the shared resolver and route-by-route ownership controls are proven.** This audit note does not change runtime code, data, secrets, deployments or migrations.


## Additional wiring check — accounting API

- `src/accounting-api.js` exports `handleAccountingRoute` and requires `auth.user.id` plus `auth.tenant.role` for role authorization.
- The current `src/index.js` main handler does **not** import or call `handleAccountingRoute`; the module is therefore not shown as wired into the active Worker route path.
- The module's unit tests invoke `handleAccountingRoute` directly with synthetic auth objects. These tests validate the module's local gates, not the real session-to-tenant context resolver or deployed route integration.

**Interpretation:** This is an integration/readiness gap, not a claim that an exposed accounting endpoint is currently exploitable. Before wiring it, require a trusted server-side tenant resolver from session + active membership, bind tenant ID to all entity/account/journal queries and writes, and run end-to-end cross-tenant negative tests through the actual Worker entry point.
