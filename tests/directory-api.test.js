import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

function makeEnv({ role = "gerante", rows = [] } = {}) {
  const calls = [];
  const DB = {
    prepare(sql) {
      calls.push({ sql, args: [] });
      const call = calls[calls.length - 1];
      return {
        bind(...args) {
          call.args = args;
          return this;
        },
        async first() {
          if (sql.includes("FROM sessions")) {
            return {
              id: "user-1", role, email: "manager@example.test",
              first_name: "Test", last_name: "Manager", phone: null,
              status: "active", created_at: "2026-01-01", updated_at: "2026-01-01",
              session_id: "session-1"
            };
          }
          throw new Error("Unexpected first() query");
        },
        async all() {
          if (!sql.includes("FROM clients") && !sql.includes("FROM intervenants")) {
            throw new Error("Unexpected directory query");
          }
          return { results: rows };
        }
      };
    }
  };
  return { env: { DB }, calls };
}

function request(path, { cookie = true, method = "GET" } = {}) {
  const headers = cookie ? { cookie: "prochelia_session=test-session" } : {};
  return new Request("https://prochelia.pages.dev" + path, { method, headers });
}

test("client directory requires an authenticated manager session", async () => {
  const { env } = makeEnv({ role: "client" });
  const unauthenticated = await worker.fetch(request("/api/clients", { cookie: false }), env);
  assert.equal(unauthenticated.status, 401);
  const forbidden = await worker.fetch(request("/api/clients"), env);
  assert.equal(forbidden.status, 403);
});

test("intervenant directory requires an authenticated manager session", async () => {
  const { env } = makeEnv({ role: "intervenant" });
  const response = await worker.fetch(request("/api/intervenants"), env);
  assert.equal(response.status, 403);
});

test("client directory returns bounded pages and only approved fields", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({
    id: "client-" + index, first_name: "First", last_name: "Last",
    account_status: "active", city: "Paris"
  }));
  const { env, calls } = makeEnv({ rows });
  const response = await worker.fetch(request("/api/clients?offset=0"), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.items.length, 100);
  assert.equal(body.has_more, true);
  assert.equal(body.next_offset, 100);
  assert.deepEqual(Object.keys(body.items[0]).sort(), ["account_status", "city", "first_name", "id", "last_name"]);
  assert.equal(calls.at(-1).args[0], 0);
});

test("intervenant directory returns bounded pages", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({
    id: "provider-" + index, first_name: "First", last_name: "Last",
    account_status: "active", professional_status: "independent",
    service_area: "Paris", validation_status: "approved"
  }));
  const { env } = makeEnv({ rows });
  const response = await worker.fetch(request("/api/intervenants?offset=100"), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.items.length, 100);
  assert.equal(body.has_more, true);
  assert.equal(body.next_offset, 200);
});

test("directory pagination rejects malformed and excessive offsets", async () => {
  const { env, calls } = makeEnv();
  for (const offset of ["-1", "1.5", "50001", "NaN"]) {
    const response = await worker.fetch(request("/api/clients?offset=" + encodeURIComponent(offset)), env);
    assert.equal(response.status, 400, offset);
  }
  assert.equal(calls.filter(call => call.sql.includes("FROM clients")).length, 0);
});

test("directory routes reject unsupported methods", async () => {
  const { env } = makeEnv();
  const clients = await worker.fetch(request("/api/clients", { method: "POST" }), env);
  const intervenants = await worker.fetch(request("/api/intervenants", { method: "POST" }), env);
  assert.equal(clients.status, 405);
  assert.equal(intervenants.status, 405);
});
