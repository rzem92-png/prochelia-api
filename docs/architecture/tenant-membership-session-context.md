# Architecture decision proposal — tenant and membership context

**Status:** PROPOSAL — review required; no schema migration or runtime behavior is changed by this document.  
**Scope:** identity, personal workspaces, organizations, memberships, server-side active tenant context, and Nexus Supra authorization.

## 1. Verified current constraints

The reviewed Nexus branch currently has these constraints:

- `users` is the account identity table and `users.role` is a single account-level role.
- `sessions` stores the session ID, user ID, token hash and expiry; it does not persist an active tenant.
- `getSessionUser()` loads the user and session but no tenant or membership.
- The first-manager bootstrap inserts a `gerante` user only; it does not create a tenant or membership.
- `clients.user_id` and `intervenants.user_id` are unique profile links. They are not proof of an organization or tenant membership.
- `business_profiles.owner_user_id` is not sufficient evidence to infer a multi-user organization.
- Nexus persisted approvals contain `tenant_id` and correctly fail closed when the authenticated server-side user has no verified tenant context.

Therefore, do not derive a tenant from a browser-supplied ID, a global role, a client/intervenant profile, or `business_profiles.owner_user_id`.

## 2. Decision proposed

Separate three concepts:

1. **Account identity** — a person represented by `users`.
2. **Workspace / tenant** — an isolated data and governance boundary. A tenant can be a personal workspace or an organization.
3. **Membership** — the server-managed relationship between a user and a tenant, with a tenant-scoped role and status.

The global `users.role` must not be treated as the authorization role inside every tenant. Preserve it during transition for legacy compatibility, but make tenant-scoped permissions depend on an active membership and its role. A later dedicated migration can rename/deprecate the global role only after every legacy route has been inventoried and migrated.

## 3. Proposed additive schema

Names below are proposals and must be checked against the full migration registry before implementation.

### `tenants`

- `id TEXT PRIMARY KEY`
- `kind TEXT NOT NULL CHECK (kind IN ('PERSONAL','ORGANIZATION'))`
- `display_name TEXT NOT NULL`
- `status TEXT NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','CLOSED'))`
- `country_code TEXT` (ISO 3166-1 alpha-2; optional until validated)
- `created_by_user_id TEXT NOT NULL REFERENCES users(id)`
- `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`

### `tenant_memberships`

- `id TEXT PRIMARY KEY`
- `tenant_id TEXT NOT NULL REFERENCES tenants(id)`
- `user_id TEXT NOT NULL REFERENCES users(id)`
- `role TEXT NOT NULL` (initial controlled set to be agreed; e.g. OWNER, ADMIN, MANAGER, MEMBER, BILLING, VIEWER)
- `status TEXT NOT NULL CHECK (status IN ('INVITED','ACTIVE','SUSPENDED','REVOKED'))`
- `invited_by_user_id TEXT REFERENCES users(id)`
- `accepted_at TEXT`, `revoked_at TEXT`
- `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`
- Unique constraint on `(tenant_id,user_id)`; indexes on `(user_id,status)` and `(tenant_id,status)`.

### `tenant_invitations` (separate invitation lifecycle)

Invitation tokens must be random, stored only as hashes, single-use, expiring, and bound to a tenant, normalized invitee identity, intended role, and inviter. Accepting an invitation must atomically create/reactivate membership and consume the invitation. Do not expose invitation secrets in logs.

### Session context

Add nullable `active_tenant_id` to `sessions` only after an explicit migration and session lifecycle review. The selected value is not trusted merely because it is stored: every authenticated request must verify that the session user still has an ACTIVE membership in an ACTIVE tenant. Membership revocation or tenant suspension must take effect immediately on the next request.

If a user has exactly one active membership, a server-side session-creation or context-initialization path may select it. If there are zero or multiple memberships, no tenant is silently guessed; the API returns a context-required response until a server-authorized selection is made.

## 4. Authorization contract

Create one central server-only resolver, conceptually `resolveTenantContext(request, env, auth)`, with this contract:

- Read the authenticated user and session from the existing secure session cookie; never from request JSON.
- Read the active tenant ID from the server-side session, not from a caller-controlled header/body/query parameter.
- Join `sessions`, `tenant_memberships`, and `tenants` and require: matching session ID, matching user ID, active session, ACTIVE membership, ACTIVE tenant.
- Return immutable server-derived context: `tenantId`, `userId`, `membershipId`, `membershipRole`.
- Fail closed on missing, suspended, revoked, ambiguous, or inconsistent context.
- Tenant switching must be a CSRF-protected same-origin POST, verify ACTIVE membership, update only the caller's session, and rotate/revalidate relevant anti-CSRF/session state as appropriate.
- Permission checks use the membership role and an explicit permission map. Never accept a role, permission map, user ID, or tenant ID supplied by the browser as authorization evidence.

Nexus routes and approval flows must receive this resolved context. Approval creation must bind tenant to the server-resolved context; approval votes, details, revocations and consumption must check both tenant and membership authorization. A tenant match alone is not sufficient to grant a vote.

## 5. Bootstrap and migration strategy

Do not create tenants implicitly during a normal login and do not bulk-map every existing account based on role.

1. Inventory all production/preview accounts and classify them using an explicit, reviewed mapping source.
2. Define the intended personal-workspace policy for clients, intervenants and platform operators.
3. Create a deterministic, auditable backfill manifest mapping each eligible user to exactly one personal tenant, and separately map verified organizations. Unknown or ambiguous records remain unmigrated and tenant-scoped access stays blocked.
4. Apply additive tables first; preserve existing user, profile, mission, payment, document and audit rows.
5. Backfill tenant rows and memberships in bounded, idempotent batches with counts, checksums and a reversible dry-run report.
6. Add tenant ownership to each tenant-scoped business table only after its ownership semantics are agreed. Backfill via verified relationships, not guesses.
7. Add composite tenant-aware foreign keys/indexes where SQLite/D1 constraints permit; ensure reads, writes, updates, deletes, exports, background jobs and webhooks all enforce tenant scope.
8. Enable tenant context for a small Preview cohort, run cross-tenant negative tests, then expand. Do not enable Production until legal, privacy, migration and restore gates pass.

## 6. Data ownership classification required before migration

Each existing table must be classified as one of:

- platform-global reference data (e.g. public service catalogue, if confirmed),
- tenant-owned business data,
- user-owned private data,
- platform security/audit data with separately defined visibility,
- externally owned provider/PSP data.

Do not blindly add `tenant_id` to every table. For example, a platform-wide catalogue may remain global, while missions, quotes, organization contracts, tenant settings and approval records likely require tenant ownership. Documents and profile records need explicit controller/processor and access semantics.

## 7. Required security and correctness tests

Before implementation is accepted, add tests for:

- anonymous access, missing tenant context, unknown tenant, suspended tenant and revoked membership;
- user A cannot read, list, update, delete, export or infer user B's tenant resources;
- changing `tenantId`, `userId`, `role` or permission fields in request body/query/header never changes authorization;
- tenant switching rejects non-members and does not alter another session;
- membership revocation and tenant suspension invalidate access immediately;
- invitation replay, expiry, wrong invitee, role escalation, concurrent acceptance and token leakage;
- session expiry/revocation and multi-session isolation;
- Supra approval request, vote, detail, revoke and consume across two tenants, including requester self-approval and unauthorized same-tenant members;
- background jobs, webhooks, exports, backup/restore and administrative support access are explicitly scoped and audited.

Use at least two synthetic tenants and two users per tenant. Assert zero cross-tenant rows and no sensitive metadata leakage in error responses.

## 8. Rollout gates

This proposal is not permission to run a remote migration.

- Gate A: schema and ownership review approved.
- Gate B: local SQLite/D1-compatible migration tests and idempotent backfill dry run pass.
- Gate C: fresh isolated EU D1 restore test passes before any Preview schema write.
- Gate D: Preview migration executed only by the reviewed main-branch workflow with exact confirmation; verify exact migration registry and tenant counts.
- Gate E: deployed Preview E2E and cross-tenant negative tests pass.
- Gate F: privacy/legal review, retention and data-subject workflows validated.
- Gate G: explicit Production go/no-go decision after evidence review.

## 9. Open decisions before coding

1. Should every client and intervenant receive a personal tenant, or should some user classes remain outside tenant workspaces?
2. Which account types may create organizations, and what verification is required?
3. Exact tenant-scoped role and permission matrix, including platform support staff.
4. Whether an organization can have multiple owners and how ownership transfer is governed.
5. Whether a user can have multiple active tenants and how the UI handles context switching.
6. Data-controller responsibilities and cross-border rules for France/Algeria.

**Safety invariant:** until these decisions and the server-side membership resolver exist, Nexus Supra approvals remain fail-closed and no privileged execution is enabled.
