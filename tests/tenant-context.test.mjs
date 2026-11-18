import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { tenantContextRoute } from "../src/index.js";
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
      return { async all() { return { results: [
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

test("tenant context route rejects non-GET methods before database access", async () => {
  const mock = makeEnv();
  const response = await tenantContextRoute(new Request("https://api.example.test/api/tenant/context", {
    method: "POST"
  }), { DB: mock.DB });
  assert.equal(response.status, 405);
  assert.equal(mock.statements.length, 0);
});
