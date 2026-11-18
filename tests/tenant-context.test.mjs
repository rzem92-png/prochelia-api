import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { tenantContextRoute } from "../src/index.js";

globalThis.crypto ??= webcrypto;
import { resolveTenantContext, tenantRoleAllowed } from "../src/tenant-context.js";

function request(tenantId) {
  const headers = {};
  return new Request("https://api.example.test/api/tenant/context", { headers });
}
const auth = { user: { id: "user-verified-by-session" } };

test("requested tenant header is accepted only with a matching active server-side membership", async () => {
  let sql = "";
  let values = [];
  const env = { DB: { prepare(statement) {
    sql = statement;
    return { bind(...args) { values = args; return { async first() {
      return { tenant_id: "tenant-a", tenant_slug: "tenant-a", tenant_name: "Tenant A",
        membership_id: "membership-a", membership_role: "FINANCE" };
    }}; }};
  }}};
  const context = await resolveTenantContext(request(), env, auth);
  assert.equal(context.ok, true);
  assert.equal(context.tenant.id, "tenant-a");
  assert.equal(context.tenant.role, "FINANCE");
  assert.deepEqual(values, ["session-a", "user-verified-by-session"]);
  assert.match(sql, /m\.status = 'ACTIVE'/);
  assert.match(sql, /t\.status = 'ACTIVE'/);
  assert.match(sql, /m\.user_id = \?/);
  assert.equal(tenantRoleAllowed(context, ["FINANCE", "OWNER"]), true);
  assert.equal(tenantRoleAllowed(context, ["OWNER"]), false);
});

test("caller-supplied tenant without membership is denied", async () => {
  const env = { DB: { prepare() { return { bind() { return { async first() { return null; } }; } }; } } };
  const context = await resolveTenantContext(request(), env, auth);
  assert.deepEqual(context, { ok: false, status: 403, error: "TENANT_MEMBERSHIP_REQUIRED" });
});

test("no tenant header resolves only a unique active membership", async () => {
  const env = { DB: { prepare() { return { bind(userId) {
    assert.equal(userId, auth.user.id);
    return { async all() { return { results: [
      { tenant_id: "tenant-a", tenant_slug: "a", tenant_name: "A", membership_id: "m-a", membership_role: "OWNER" }
    ] }; }};
  }}; }}};
  const context = await resolveTenantContext(request(), env, auth);
  assert.equal(context.ok, true);
  assert.equal(context.tenant.id, "tenant-a");
});

test("multiple active memberships require explicit tenant selection", async () => {
  const env = { DB: { prepare() { return { bind() { return { async all() { return { results: [
    { tenant_id: "tenant-a" }, { tenant_id: "tenant-b" }
  ] }; }}; }}; }}};
  const context = await resolveTenantContext(request(), env, auth);
  assert.deepEqual(context, { ok: false, status: 409, error: "TENANT_SELECTION_REQUIRED" });
});

test("missing membership, inactive tenant and database failure all fail closed", async () => {
  assert.equal((await resolveTenantContext(request(), null, auth)).status, 503);
  assert.equal((await resolveTenantContext(request(), {}, null)).status, 401);
  const broken = { DB: { prepare() { throw new Error("synthetic D1 unavailable"); } } };
  assert.deepEqual(await resolveTenantContext(request(), broken, auth),
    { ok: false, status: 503, error: "TENANT_CONTEXT_UNAVAILABLE" });
});

function routeEnv({ authenticated = true, membership = true } = {}) {
  const statements = [];
  return {
    statements,
    env: { DB: { prepare(sql) {
      statements.push(sql);
      return { bind() {
        if (sql.includes("FROM sessions s")) {
          return { async first() {
            return authenticated ? {
              id: "user-verified-by-session", role: "client", email: "u@example.test",
              first_name: "Test", last_name: "User", phone: null, status: "active",
              created_at: "2026-11-18", updated_at: "2026-11-18", session_id: "session-a", session_active_tenant_id: "tenant-a"
            } : null;
          }};
        }
        if (sql.includes("FROM tenant_memberships m")) {
          return { async first() {
            return membership ? {
              tenant_id: "tenant-a", tenant_slug: "tenant-a", tenant_name: "Tenant A",
              membership_id: "membership-a", membership_role: "OWNER"
            } : null;
          }};
        }
        throw new Error("Unexpected SQL: " + sql);
      }};
    }}}
  };
}

test("authenticated tenant context route returns only server-resolved active membership", async () => {
  const { env, statements } = routeEnv();
  const req = new Request("https://api.example.test/api/tenant/context", {
    headers: { cookie: "prochelia_session=synthetic-session-token" }
  });
  const response = await tenantContextRoute(req, env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.tenant.id, "tenant-a");
  assert.equal(body.tenant.role, "OWNER");
  assert.equal(statements.length, 2);
});

test("tenant context route rejects unauthenticated and non-member requests", async () => {
  const unauth = routeEnv({ authenticated: false });
  const req = new Request("https://api.example.test/api/tenant/context", {
    headers: { cookie: "prochelia_session=synthetic-session-token", "x-prochelia-tenant-id": "tenant-a" }
  });
  assert.equal((await tenantContextRoute(req, unauth.env)).status, 401);
  assert.equal(unauth.statements.length, 1);
  const nonMember = routeEnv({ membership: false });
  assert.equal((await tenantContextRoute(req, nonMember.env)).status, 403);
  assert.equal(nonMember.statements.length, 2);
});

test("tenant context route is read-only and rejects non-GET methods before database access", async () => {
  const { env, statements } = routeEnv();
  const response = await tenantContextRoute(new Request("https://api.example.test/api/tenant/context", { method: "POST" }), env);
  assert.equal(response.status, 405);
  assert.equal(statements.length, 0);
});
