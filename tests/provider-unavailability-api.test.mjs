import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleProviderUnavailabilityRoute } from "../src/provider-unavailability-api.js";

const auth = { user: { id: "user-provider-a", role: "intervenant" }, session_id: "session-a" };
const tenantRows = [{ tenant_id: "tenant-a", membership_role: "PROVIDER" }];
const profile = { id: "provider-a" };
const columns = [
  "id", "tenant_id", "intervenant_id", "start_at", "end_at", "timezone_name",
  "reason", "status", "created_by_user_id", "created_at", "updated_at", "idempotency_key"
].map(name => ({ name }));

function fakeDb(options = {}) {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async all() {
              calls.push({ sql, values, method: "all" });
              if (sql.includes("tenant_memberships")) return options.memberships ?? { success: true, results: tenantRows };
              if (sql.includes("PRAGMA table_info")) return options.columns ?? { success: true, results: columns };
              if (sql.includes("ORDER BY start_at ASC")) return options.list ?? { success: true, results: [] };
              return { success: true, results: [] };
            },
            async first() {
              calls.push({ sql, values, method: "first" });
              if (sql.includes("FROM intervenants")) return options.profile ?? profile;
              if (sql.includes("idempotency_key")) return options.previous ?? null;
              if (sql.includes("FROM provider_unavailability")) return options.existing ?? null;
              return null;
            },
            async run() {
              calls.push({ sql, values, method: "run" });
              if (sql.startsWith("INSERT")) {
                if (options.insertError) throw options.insertError;
                return options.insertResult ?? { meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE")) return options.updateResult ?? { meta: { changes: 1 } };
              return { meta: { changes: 0 } };
            }
          };
        }
      };
    }
  };
  return { db, calls };
}

function request(method = "GET", path = "/api/intervenant/unavailability", body = null, headers = {}) {
  return new Request("https://api.prochelia.test" + path, {
    method,
    headers: body ? { "content-type": "application/json", ...headers } : headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

function futureInterval() {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start_at: start.toISOString(), end_at: end.toISOString(), timezone_name: "Europe/Paris", reason: "Rendez-vous" };
}

test("unavailability endpoint is wired into the Worker handler", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(source, /handleProviderUnavailabilityRoute/);
  assert.match(source, /\/api\/intervenant\/unavailability/);
});

test("unauthenticated, wrong-role and missing tenant membership fail closed", async () => {
  const { db } = fakeDb();
  assert.equal((await handleProviderUnavailabilityRoute(request(), { DB: db }, null)).status, 401);
  assert.equal((await handleProviderUnavailabilityRoute(request(), { DB: db }, { ...auth, user: { ...auth.user, role: "client" } })).status, 403);
  const noMembership = fakeDb({ memberships: { success: true, results: [] } });
  assert.equal((await handleProviderUnavailabilityRoute(request(), { DB: noMembership.db }, auth)).status, 403);
});

test("ambiguous tenant and non-provider membership fail closed", async () => {
  const multi = fakeDb({ memberships: { success: true, results: [{ ...tenantRows[0] }, { tenant_id: "tenant-b", membership_role: "PROVIDER" }] } });
  const otherRole = fakeDb({ memberships: { success: true, results: [{ tenant_id: "tenant-a", membership_role: "CLIENT" }] } });
  assert.equal((await handleProviderUnavailabilityRoute(request(), { DB: multi.db }, auth)).status, 409);
  assert.equal((await handleProviderUnavailabilityRoute(request(), { DB: otherRole.db }, auth)).status, 403);
});

test("schema and provider profile are required before any operation", async () => {
  const schemaMissing = fakeDb({ columns: { success: true, results: [{ name: "id" }] } });
  assert.equal((await handleProviderUnavailabilityRoute(request(), { DB: schemaMissing.db }, auth)).status, 503);
  const profileMissing = fakeDb({ profile: null });
  assert.equal((await handleProviderUnavailabilityRoute(request(), { DB: profileMissing.db }, auth)).status, 404);
});

test("GET reads only the authenticated tenant and provider profile", async () => {
  const { db, calls } = fakeDb({ list: { success: true, results: [{ id: "block-a", status: "ACTIVE" }] } });
  const response = await handleProviderUnavailabilityRoute(request(), { DB: db }, auth);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.read_only, true);
  assert.deepEqual(body.unavailability, [{ id: "block-a", status: "ACTIVE" }]);
  const list = calls.find(call => call.sql.includes("ORDER BY start_at ASC"));
  assert.deepEqual(list.values, ["tenant-a", "provider-a", "ACTIVE"]);
});

test("GET rejects an invalid status filter", async () => {
  const { db } = fakeDb();
  assert.equal((await handleProviderUnavailabilityRoute(request("GET", "/api/intervenant/unavailability?status=HACK"), { DB: db }, auth)).status, 400);
});

test("POST validates UTC interval, IANA timezone, reason and idempotency key", async () => {
  const { db, calls } = fakeDb();
  const payload = futureInterval();
  const invalidDate = { ...payload, start_at: "2026-02-30T12:00:00Z" };
  const invalidZone = { ...payload, timezone_name: "Mars/Olympus" };
  const tooLongReason = { ...payload, reason: "x".repeat(121) };
  assert.equal((await handleProviderUnavailabilityRoute(request("POST", undefined, invalidDate, { "Idempotency-Key": "key-valid-123" }), { DB: db }, auth)).status, 400);
  assert.equal((await handleProviderUnavailabilityRoute(request("POST", undefined, invalidZone, { "Idempotency-Key": "key-valid-123" }), { DB: db }, auth)).status, 400);
  assert.equal((await handleProviderUnavailabilityRoute(request("POST", undefined, tooLongReason, { "Idempotency-Key": "key-valid-123" }), { DB: db }, auth)).status, 400);
  assert.equal((await handleProviderUnavailabilityRoute(request("POST", undefined, payload), { DB: db }, auth)).status, 400);
  assert.equal(calls.filter(call => call.method === "run").length, 0);
});

test("POST inserts with derived tenant/profile and authenticated creator", async () => {
  const { db, calls } = fakeDb();
  const payload = futureInterval();
  const response = await handleProviderUnavailabilityRoute(request("POST", undefined, payload, { "Idempotency-Key": "key-valid-123" }), { DB: db }, auth);
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.unavailability.status, "ACTIVE");
  const insert = calls.find(call => call.sql.startsWith("INSERT"));
  assert.deepEqual(insert.values.slice(1, 3), ["tenant-a", "provider-a"]);
  assert.equal(insert.values[7], auth.user.id);
  assert.equal(insert.values[8], "key-valid-123");
  assert.ok(!insert.values.includes("tenant-evil"));
});

test("POST replay is idempotent and changed payload with the same key conflicts", async () => {
  const payload = futureInterval();
  const previous = { id: "block-existing", ...payload, status: "ACTIVE" };
  const replay = fakeDb({ previous });
  const replayResponse = await handleProviderUnavailabilityRoute(request("POST", undefined, payload, { "Idempotency-Key": "key-valid-123" }), { DB: replay.db }, auth);
  assert.equal(replayResponse.status, 200);
  assert.equal((await replayResponse.json()).idempotent_replay, true);
  const conflict = fakeDb({ previous: { ...previous, reason: "other" } });
  assert.equal((await handleProviderUnavailabilityRoute(request("POST", undefined, payload, { "Idempotency-Key": "key-valid-123" }), { DB: conflict.db }, auth)).status, 409);
});

test("POST maps server-side overlap trigger to a conflict", async () => {
  const { db } = fakeDb({ insertError: new Error("PROVIDER_UNAVAILABILITY_OVERLAP") });
  const payload = futureInterval();
  const response = await handleProviderUnavailabilityRoute(request("POST", undefined, payload, { "Idempotency-Key": "key-valid-123" }), { DB: db }, auth);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "UNAVAILABILITY_OVERLAP");
});

test("DELETE is tenant/profile scoped, soft-cancels and supports replay", async () => {
  const { db, calls } = fakeDb({ existing: { id: "block-existing", start_at: futureInterval().start_at, status: "ACTIVE" } });
  const response = await handleProviderUnavailabilityRoute(request("DELETE", "/api/intervenant/unavailability?id=block-existing"), { DB: db }, auth);
  assert.equal(response.status, 200);
  const update = calls.find(call => call.sql.startsWith("UPDATE"));
  assert.deepEqual(update.values.slice(0, 3), ["block-existing", "tenant-a", "provider-a"]);
  const replay = fakeDb({ existing: { id: "block-existing", start_at: futureInterval().start_at, status: "CANCELLED" } });
  assert.equal((await handleProviderUnavailabilityRoute(request("DELETE", "/api/intervenant/unavailability?id=block-existing"), { DB: replay.db }, auth)).status, 200);
});

test("DELETE refuses missing, invalid, expired or concurrently changed records", async () => {
  const missing = fakeDb({ existing: null });
  assert.equal((await handleProviderUnavailabilityRoute(request("DELETE", "/api/intervenant/unavailability?id=block-missing"), { DB: missing.db }, auth)).status, 404);
  const invalid = fakeDb();
  assert.equal((await handleProviderUnavailabilityRoute(request("DELETE", "/api/intervenant/unavailability?id=bad"), { DB: invalid.db }, auth)).status, 400);
  const expired = fakeDb({ existing: { id: "block-existing", start_at: new Date(Date.now() - 1000).toISOString(), status: "ACTIVE" } });
  assert.equal((await handleProviderUnavailabilityRoute(request("DELETE", "/api/intervenant/unavailability?id=block-existing"), { DB: expired.db }, auth)).status, 409);
  const stale = fakeDb({ existing: { id: "block-existing", start_at: futureInterval().start_at, status: "ACTIVE" }, updateResult: { meta: { changes: 0 } } });
  assert.equal((await handleProviderUnavailabilityRoute(request("DELETE", "/api/intervenant/unavailability?id=block-existing"), { DB: stale.db }, auth)).status, 409);
});
