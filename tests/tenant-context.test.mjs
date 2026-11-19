import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { tenantContextRoute, selectTenantForSession } from "../src/index.js";
globalThis.crypto ??= webcrypto;

function makeEnv({ authenticated = true, membership = true, activeTenant = "tenant-a" } = {}) {
  const statements = [];
  return {
    statements,
    DB: { prepare(sql) {
      statements.push(sql);
      return { bind(...args) {
        if (sql.includes("FROM sessions s") && sql.includes("JOIN users u")) {
          return { async first() {
            return authenticated ? {
              id: "user-verified-by-session", role: "client", email: "u@example.test",
              first_name: "Test", last_name: "User", phone: null, status: "active",
              created_at: "2026-11-18", updated_at: "2026-11-18",
              session_id: "session-a", session_active_tenant_id: activeTenant
            } : null;
          }};
        }
        if (sql.includes("FROM sessions s") && sql.includes("JOIN tenant_memberships m")) {
          return { async first() {
            return membership ? {
              tenant_id: "tenant-a", tenant_slug: "tenant-a", tenant_name: "Tenant A",
              membership_id: "membership-a", membership_role: "OWNER"
            } : null;
          }};
        }
        throw new Error("Unexpected SQL: " + sql + " args=" + JSON.stringify(args));
      }};
    }}
  };
}

test("tenant context is derived from authenticated server-side session, not request headers", async () => {
  const mock = makeEnv();
  const req = new Request("https://api.example.test/api/tenant/context", {
    headers: {
      cookie: "prochelia_session=synthetic-session-token",
      "x-prochelia-tenant-id": "attacker-selected-tenant"
    }
  });
  const response = await tenantContextRoute(req, { DB: mock.DB });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.tenant.id, "tenant-a");
  assert.equal(body.tenant.role, "OWNER");
  assert.match(mock.statements[1], /s\.active_tenant_id/);
  assert.match(mock.statements[1], /m\.status = 'ACTIVE'/);
  assert.match(mock.statements[1], /t\.status = 'ACTIVE'/);
});

test("tenant context route rejects unauthenticated and revoked/non-member sessions", async () => {
  const unauth = makeEnv({ authenticated: false });
  const req = new Request("https://api.example.test/api/tenant/context", {
    headers: { cookie: "prochelia_session=synthetic-session-token" }
  });
  assert.equal((await tenantContextRoute(req, { DB: unauth.DB })).status, 401);
  assert.equal(unauth.statements.length, 1);
  const nonMember = makeEnv({ membership: false });
  assert.equal((await tenantContextRoute(req, { DB: nonMember.DB })).status, 403);
  assert.equal(nonMember.statements.length, 2);
});

test("tenant context fails closed when session has no selection and memberships are ambiguous", async () => {
  const mock = makeEnv({ activeTenant: null });
  mock.DB.prepare = (sql) => {
    mock.statements.push(sql);
    return { bind() {
      if (sql.includes("JOIN users u")) return { async first() {
        return { id: "user-verified-by-session", role: "client", status: "active",
          session_id: "session-a", session_active_tenant_id: null };
      }};
      return { async all() { return { success: true, results: [
        { tenant_id: "tenant-a" }, { tenant_id: "tenant-b" }
      ]}; }};
    }};
  };
  const req = new Request("https://api.example.test/api/tenant/context", {
    headers: { cookie: "prochelia_session=synthetic-session-token" }
  });
  const response = await tenantContextRoute(req, { DB: mock.DB });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "TENANT_SELECTION_REQUIRED");
});


test("tenant context refuses partial membership rows when D1 explicitly reports failure", async () => {
  for (const d1Response of [
    { success: false, results: [{
      tenant_id: "tenant-attacker", tenant_slug: "attacker", tenant_name: "Untrusted",
      membership_id: "membership-untrusted", membership_role: "OWNER"
    }] },
    { results: [{
      tenant_id: "tenant-attacker", tenant_slug: "attacker", tenant_name: "Untrusted",
      membership_id: "membership-untrusted", membership_role: "OWNER"
    }] }
  ]) {
    const statements = [];
    const DB = { prepare(sql) {
      statements.push(sql);
      return { bind() {
        if (sql.includes("JOIN users u")) return { async first() {
          return { id: "user-verified-by-session", role: "client", status: "active",
            session_id: "session-a", session_active_tenant_id: null };
        }};
        return { async all() { return d1Response; }};
      }};
    }};
    const req = new Request("https://api.example.test/api/tenant/context", {
      headers: { cookie: "prochelia_session=synthetic-session-token" }
    });
    const response = await tenantContextRoute(req, { DB });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "TENANT_CONTEXT_UNAVAILABLE");
    assert.equal(statements.length, 2);
  }
});

test("tenant context route rejects non-GET methods before database access", async () => {
  const mock = makeEnv();
  const response = await tenantContextRoute(new Request("https://api.example.test/api/tenant/context", {
    method: "POST"
  }), { DB: mock.DB });
  assert.equal(response.status, 405);
  assert.equal(mock.statements.length, 0);
});

test("tenant selection updates only the authenticated session after strict Origin and membership checks", async () => {
  const statements = [];
  const DB = { prepare(sql) {
    statements.push(sql);
    return { bind(...args) {
      if (sql.includes("JOIN users u")) return { async first() {
        return { id: "user-verified-by-session", role: "client", status: "active",
          session_id: "session-a", session_active_tenant_id: null };
      }};
      if (sql.includes("UPDATE sessions")) {
        assert.deepEqual(args, ["tenant-a", "session-a", "user-verified-by-session", "tenant-a"]);
        return { async run() { return { meta: { changes: 1 } }; }};
      }
      if (sql.includes("JOIN tenant_memberships m")) return { async first() {
        return { tenant_id: "tenant-a", tenant_slug: "tenant-a", tenant_name: "Tenant A",
          membership_id: "membership-a", membership_role: "OWNER" };
      }};
      throw new Error("Unexpected SQL: " + sql);
    }};
  }};
  const req = new Request("https://api.example.test/api/tenant/select", {
    method: "POST",
    headers: {
      origin: "https://4c3cec36.prochelia.pages.dev",
      "content-type": "application/json",
      cookie: "prochelia_session=synthetic-session-token"
    },
    body: JSON.stringify({ tenant_id: "tenant-a" })
  });
  const response = await selectTenantForSession(req, { DB, CORS_ORIGIN: "https://4c3cec36.prochelia.pages.dev" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).tenant.id, "tenant-a");
  assert.match(statements[1], /EXISTS/);
  assert.match(statements[1], /m\.status = 'ACTIVE'/);
  assert.match(statements[1], /t\.status = 'ACTIVE'/);
});

test("tenant selection rejects absent/untrusted Origin before database access", async () => {
  const DB = { prepare() { throw new Error("DB must not be reached"); } };
  const req = new Request("https://api.example.test/api/tenant/select", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: "tenant-a" })
  });
  const response = await selectTenantForSession(req, { DB, CORS_ORIGIN: "https://4c3cec36.prochelia.pages.dev" });
  assert.equal(response.status, 403);
});
