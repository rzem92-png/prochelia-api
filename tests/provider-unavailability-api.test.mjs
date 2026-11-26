import test from "node:test";
import assert from "node:assert/strict";
import { handleProviderUnavailabilityRoute } from "../src/provider-unavailability-api.js";

const BASE = "/api/v7/provider-unavailability";
const auth = (id = "user-1", role = "client") => ({ user: { id, role, email: id + "@example.test" } });
const membership = (role = "PROVIDER", tenantId = "tenant-a") => ({ tenant_id: tenantId, role, status: "ACTIVE", tenant_status: "ACTIVE" });
const provider = (id = "provider-1", userId = "user-1", tenantId = "tenant-a") => ({ id, user_id: userId, tenant_id: tenantId });
const block = (id = "block-1", providerId = "provider-1", tenantId = "tenant-a", status = "ACTIVE") => ({
  id, tenant_id: tenantId, intervenant_id: providerId,
  start_at: "2026-11-26T09:00:00.000Z", end_at: "2026-11-26T10:00:00.000Z",
  timezone_name: "Europe/Paris", reason: "", status,
  created_at: "2026-11-26T00:00:00.000Z", updated_at: "2026-11-26T00:00:00.000Z"
});
const req = (method, path = BASE, body = null, headers = {}) => new Request("https://api.preview" + path, {
  method, headers: { "content-type": "application/json", ...headers }, ...(body !== null ? { body: JSON.stringify(body) } : {})
});

function mockDB({ memberships = [], providers = [], blocks = [], failSchema = false, insertError = null } = {}) {
  const calls = [];
  const db = {
    prepare(sql) {
      if (failSchema && sql.includes("tenant_memberships")) throw new Error("no such table: tenant_memberships");
      return {
        bind(...params) {
          calls.push({ sql, params });
          return {
            async all() {
              if (sql.includes("tenant_memberships")) {
                const selectedTenant = sql.includes(" AND tm.tenant_id = ?") ? params[1] : null;
                return { results: memberships.filter(m => !selectedTenant || m.tenant_id === selectedTenant) };
              }
              if (sql.includes("provider_unavailability")) {
                let rows = blocks.filter(x => x.tenant_id === params[0]);
                if (sql.includes("intervenant_id = ?")) rows = rows.filter(x => x.intervenant_id === params[1]);
                if (sql.includes("status = 'ACTIVE'")) rows = rows.filter(x => x.status === "ACTIVE");
                return { results: rows };
              }
              return { results: [] };
            },
            async first() {
              if (sql.includes("intervenants")) {
                if (sql.includes("user_id = ?")) return providers.find(x => x.user_id === params[0] && x.tenant_id === params[1]) || null;
                return providers.find(x => x.id === params[0] && x.tenant_id === params[1]) || null;
              }
              if (sql.includes("provider_unavailability") && sql.includes("WHERE id = ?")) {
                return blocks.find(x => x.id === params[0] && x.tenant_id === params[1]) || null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO provider_unavailability")) {
                if (insertError) throw insertError;
                const [id, tenant_id, intervenant_id, start_at, end_at, timezone_name, reason, created_by_user_id] = params;
                blocks.push({
                  id, tenant_id, intervenant_id, start_at, end_at, timezone_name, reason, status: "ACTIVE",
                  created_by_user_id, created_at: "2026-11-26T00:00:00.000Z", updated_at: "2026-11-26T00:00:00.000Z"
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE provider_unavailability")) {
                const [id, tenantId, providerId] = params;
                const row = blocks.find(x => x.id === id && x.tenant_id === tenantId && (!sql.includes("intervenant_id = ?") || x.intervenant_id === providerId) && x.status === "ACTIVE");
                if (row) {
                  row.status = "CANCELLED";
                  row.updated_at = "2026-11-26T01:00:00.000Z";
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              return { meta: { changes: 0 } };
            }
          };
        }
      };
    }
  };
  return { db, calls };
}

test("route is isolated, unauthenticated requests fail and missing tenant schema fails closed", async () => {
  assert.equal(await handleProviderUnavailabilityRoute(req("GET", "/api/v7/other"), {}, "/api/v7/other", auth()), null);
  const unauth = await handleProviderUnavailabilityRoute(req("GET"), { DB: mockDB().db }, BASE, null);
  assert.equal(unauth.status, 401);
  const missing = await handleProviderUnavailabilityRoute(req("GET"), { DB: mockDB({ failSchema: true }).db }, BASE, auth());
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error, "TENANT_SCHEMA_UNAVAILABLE");
  const noDb = await handleProviderUnavailabilityRoute(req("GET"), {}, BASE, auth());
  assert.equal(noDb.status, 503);
});

test("tenant membership is required and ambiguous membership requires explicit selection", async () => {
  const noMembership = await handleProviderUnavailabilityRoute(req("GET"), { DB: mockDB().db }, BASE, auth());
  assert.equal(noMembership.status, 403);
  const multi = mockDB({ memberships: [membership("ADMIN"), membership("OPS", "tenant-b")] });
  const ambiguous = await handleProviderUnavailabilityRoute(req("GET"), { DB: multi.db }, BASE, auth("user-1", "gerante"));
  assert.equal(ambiguous.status, 409);
  assert.equal((await ambiguous.json()).error, "TENANT_SELECTION_REQUIRED");
  const wrongTenant = await handleProviderUnavailabilityRoute(req("GET", BASE, null, { "x-tenant-id": "tenant-c" }), { DB: multi.db }, BASE, auth());
  assert.equal(wrongTenant.status, 403);
});

test("provider GET is scoped to own provider and tenant", async () => {
  const db = mockDB({ memberships: [membership()], providers: [provider(), provider("provider-2", "user-2")], blocks: [block(), block("block-2", "provider-2"), block("block-3", "provider-3", "tenant-b")] });
  const forbidden = await handleProviderUnavailabilityRoute(req("GET", BASE + "?providerId=provider-2"), { DB: db.db }, BASE, auth());
  assert.equal(forbidden.status, 403);
  const own = await handleProviderUnavailabilityRoute(req("GET"), { DB: db.db }, BASE, auth());
  assert.equal(own.status, 200);
  const data = await own.json();
  assert.deepEqual(data.unavailability.map(x => x.providerId), ["provider-1"]);
  assert.equal(data.tenantId, "tenant-a");
});

test("tenant admin can filter within tenant and cross-tenant provider IDs are not disclosed", async () => {
  const db = mockDB({ memberships: [membership("ADMIN")], providers: [provider(), provider("provider-2", "user-2")], blocks: [block(), block("block-2", "provider-2"), block("block-3", "provider-3", "tenant-b")] });
  const response = await handleProviderUnavailabilityRoute(req("GET", BASE + "?providerId=provider-2"), { DB: db.db }, BASE, auth("user-1", "gerante"));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).unavailability.map(x => x.providerId), ["provider-2"]);
  const cross = await handleProviderUnavailabilityRoute(req("GET", BASE + "?providerId=provider-3"), { DB: db.db }, BASE, auth("user-1", "gerante"));
  assert.equal(cross.status, 404);
});

test("provider creates only own profile; tenant and creator are derived from session", async () => {
  const db = mockDB({ memberships: [membership()], providers: [provider()] });
  const response = await handleProviderUnavailabilityRoute(req("POST", BASE, { tenantId: "tenant-b", providerId: "provider-1", startAt: "2026-11-26T09:00:00Z", endAt: "2026-11-26T10:00:00Z", timeZone: "Europe/Paris", reason: "Congé" }), { DB: db.db }, BASE, auth());
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.unavailability.providerId, "provider-1");
  const insert = db.calls.find(x => x.sql.includes("INSERT INTO provider_unavailability"));
  assert.equal(insert.params[1], "tenant-a");
  assert.equal(insert.params.at(-1), "user-1");
  assert.equal(insert.params[6], "Congé");
  assert.equal(data.unavailability.status, "ACTIVE");
});

test("invalid UTC, reversed interval, invalid IANA timezone and overlong reason are rejected", async () => {
  const db = mockDB({ memberships: [membership()], providers: [provider()] });
  const cases = [
    { startAt: "2026-11-26T09:00:00", endAt: "2026-11-26T10:00:00Z", timeZone: "Europe/Paris" },
    { startAt: "2026-11-26T10:00:00Z", endAt: "2026-11-26T09:00:00Z", timeZone: "Europe/Paris" },
    { startAt: "2026-11-26T09:00:00Z", endAt: "2026-11-26T10:00:00Z", timeZone: "Not/AZone" },
    { startAt: "2026-11-26T09:00:00Z", endAt: "2026-11-26T10:00:00Z", timeZone: "Europe/Paris", reason: "x".repeat(121) }
  ];
  for (const value of cases) {
    const response = await handleProviderUnavailabilityRoute(req("POST", BASE, { providerId: "provider-1", ...value }), { DB: db.db }, BASE, auth());
    assert.equal(response.status, 400);
  }
});

test("overlap database guard maps to conflict and not a generic failure", async () => {
  const db = mockDB({ memberships: [membership()], providers: [provider()], insertError: new Error("PROVIDER_UNAVAILABILITY_OVERLAP") });
  const response = await handleProviderUnavailabilityRoute(req("POST", BASE, { providerId: "provider-1", startAt: "2026-11-26T09:00:00Z", endAt: "2026-11-26T10:00:00Z", timeZone: "Europe/Paris" }), { DB: db.db }, BASE, auth());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "UNAVAILABILITY_CONFLICT");
});

test("cancellation is a soft status change scoped by tenant and provider", async () => {
  const db = mockDB({ memberships: [membership()], providers: [provider()], blocks: [block(), block("block-2", "provider-2")] });
  const response = await handleProviderUnavailabilityRoute(req("DELETE", BASE + "/block-1"), { DB: db.db }, BASE + "/block-1", auth());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).unavailability.status, "CANCELLED");
  const update = db.calls.find(x => x.sql.includes("UPDATE provider_unavailability"));
  assert.equal(update.params[1], "tenant-a");
  const other = await handleProviderUnavailabilityRoute(req("DELETE", BASE + "/block-2"), { DB: db.db }, BASE + "/block-2", auth());
  assert.equal(other.status, 404);
});

test("read-only role cannot create or cancel and unknown methods are rejected", async () => {
  const db = mockDB({ memberships: [membership("READ_ONLY")] });
  const create = await handleProviderUnavailabilityRoute(req("POST", BASE, { providerId: "provider-1" }), { DB: db.db }, BASE, auth());
  assert.equal(create.status, 403);
  const cancel = await handleProviderUnavailabilityRoute(req("DELETE", BASE + "/block-1"), { DB: db.db }, BASE + "/block-1", auth());
  assert.equal(cancel.status, 403);
  const put = await handleProviderUnavailabilityRoute(req("PUT"), { DB: db.db }, BASE, auth());
  assert.equal(put.status, 405);
});
