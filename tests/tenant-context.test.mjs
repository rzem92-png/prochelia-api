import test from "node:test";
import assert from "node:assert/strict";
import { resolveTenantContext, tenantRoleAllowed } from "../src/tenant-context.js";

function request(tenantId) {
  const headers = tenantId ? { "x-prochelia-tenant-id": tenantId } : {};
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
  const context = await resolveTenantContext(request("tenant-a"), env, auth);
  assert.equal(context.ok, true);
  assert.equal(context.tenant.id, "tenant-a");
  assert.equal(context.tenant.role, "FINANCE");
  assert.deepEqual(values, ["user-verified-by-session", "tenant-a"]);
  assert.match(sql, /m\.status = 'ACTIVE'/);
  assert.match(sql, /t\.status = 'ACTIVE'/);
  assert.match(sql, /m\.user_id = \?/);
  assert.equal(tenantRoleAllowed(context, ["FINANCE", "OWNER"]), true);
  assert.equal(tenantRoleAllowed(context, ["OWNER"]), false);
});

test("caller-supplied tenant without membership is denied", async () => {
  const env = { DB: { prepare() { return { bind() { return { async first() { return null; } }; } }; } } };
  const context = await resolveTenantContext(request("tenant-owned-by-another-user"), env, auth);
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
