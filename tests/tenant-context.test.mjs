import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";
import { listTenantContexts, selectTenantContext } from "../src/tenant-context.js";

const migration = readFileSync(new URL("../migrations-preview-canonical/0023_tenant_workspace_foundation.sql", import.meta.url), "utf8");
const sessionToken = "tenant-context-test-session";

function makeD1() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, role TEXT NOT NULL, email TEXT, first_name TEXT, last_name TEXT,
      phone TEXT, status TEXT NOT NULL, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL, expires_at TEXT NOT NULL
    );
  `);
  sqlite.exec(migration);
  sqlite.exec(`
    INSERT INTO users(id,role,email,first_name,last_name,status,created_at,updated_at)
    VALUES ('u1','client','u1@example.test','One','User','active','2026-01-01','2026-01-01'),
           ('u2','client','u2@example.test','Two','User','active','2026-01-01','2026-01-01');
    INSERT INTO sessions(id,user_id,token_hash,expires_at)
    VALUES ('s1','u1','TQVEcD9psvMekhpwgMQj5fHUYSNGsCcRAyMM7zLCVTs','2099-01-01'),
           ('s2','u2','hash-u2','2099-01-01');
    INSERT INTO tenants(id,kind,display_name,country_code,created_by_user_id)
    VALUES ('t1','PERSONAL','Workspace One','FR','u1'),
           ('t2','ORGANIZATION','Company Two','BE','u1'),
           ('t3','ORGANIZATION','Workspace Three','DZ','u2');
    INSERT INTO tenant_memberships(id,tenant_id,user_id,role,status,accepted_at)
    VALUES ('m1','t1','u1','OWNER','ACTIVE','2026-01-01'),
           ('m2','t2','u1','ADMIN','ACTIVE','2026-01-01'),
           ('m3','t3','u2','OWNER','ACTIVE','2026-01-01');
  `);
  return {
    sqlite,
    d1: {
      prepare(sql) {
        let params = [];
        return {
          bind(...values) { params = values; return this; },
          all() { return { results: sqlite.prepare(sql).all(...params) }; },
          first() { return sqlite.prepare(sql).get(...params) ?? null; },
          run() {
            const result = sqlite.prepare(sql).run(...params);
            return { meta: { changes: Number(result.changes) } };
          }
        };
      }
    }
  };
}

function request(path, method = "GET", body, cookie = sessionToken) {
  const headers = {};
  if (cookie) headers.cookie = `prochelia_session=${cookie}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`https://preview.example${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
}

test("tenant context listing is session/user scoped and minimizes returned fields", async () => {
  const { d1 } = makeD1();
  const one = await listTenantContexts(d1, "s1", "u1");
  const two = await listTenantContexts(d1, "s2", "u2");
  assert.deepEqual(one.tenants.map(x => x.id), ["t1", "t2"]);
  assert.deepEqual(two.tenants.map(x => x.id), ["t3"]);
  assert.equal(one.selectedTenantId, null);
  assert.deepEqual(Object.keys(one.tenants[0]).sort(), ["countryCode", "id", "kind", "name", "role", "selected"]);
});

test("selection is bound to the authenticated session and active membership", async () => {
  const { d1 } = makeD1();
  assert.equal(await selectTenantContext(d1, "s1", "u1", "t2"), true);
  assert.equal((await listTenantContexts(d1, "s1", "u1")).selectedTenantId, "t2");
  assert.equal(await selectTenantContext(d1, "s1", "u1", "t3"), false);
  assert.equal(await selectTenantContext(d1, "s1", "u2", "t3"), false);
  assert.equal((await listTenantContexts(d1, "s1", "u1")).selectedTenantId, "t2");
});

test("suspension and membership revocation clear selected context and hide inactive tenants", async () => {
  const { sqlite, d1 } = makeD1();
  assert.equal(await selectTenantContext(d1, "s1", "u1", "t2"), true);
  sqlite.prepare("UPDATE tenants SET status='SUSPENDED' WHERE id='t2'").run();
  assert.equal((await listTenantContexts(d1, "s1", "u1")).selectedTenantId, null);
  assert.deepEqual((await listTenantContexts(d1, "s1", "u1")).tenants.map(x => x.id), ["t1"]);
  assert.equal(await selectTenantContext(d1, "s1", "u1", "t2"), false);
  assert.equal(await selectTenantContext(d1, "s1", "u1", "t1"), true);
  sqlite.prepare("UPDATE tenant_memberships SET status='REVOKED',revoked_at=CURRENT_TIMESTAMP WHERE id='m1'").run();
  assert.deepEqual((await listTenantContexts(d1, "s1", "u1")).tenants, []);
  assert.equal((await listTenantContexts(d1, "s1", "u1")).selectedTenantId, null);
});

test("Worker GET tenant context requires a session and returns only active memberships", async () => {
  const { d1 } = makeD1();
  const unauth = await worker.fetch(request("/api/tenant/context", "GET", undefined, null), { DB: d1 });
  assert.equal(unauth.status, 401);
  const response = await worker.fetch(request("/api/tenant/context"), { DB: d1 });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.selectedTenantId, null);
  assert.deepEqual(body.tenants.map(x => x.id), ["t1", "t2"]);
});

test("Worker selection rejects non-member and persists valid selected tenant", async () => {
  const { d1 } = makeD1();
  const denied = await worker.fetch(request("/api/tenant/context/select", "POST", { tenantId: "t3" }), { DB: d1 });
  assert.equal(denied.status, 403);
  const accepted = await worker.fetch(request("/api/tenant/context/select", "POST", { tenantId: "t2" }), { DB: d1 });
  assert.equal(accepted.status, 200);
  const acceptedBody = await accepted.json();
  assert.equal(acceptedBody.ok, true);
  assert.equal(acceptedBody.selectedTenantId, "t2");
  const listing = await worker.fetch(request("/api/tenant/context"), { DB: d1 });
  assert.equal((await listing.json()).selectedTenantId, "t2");
});

test("tenant context returns unavailable rather than falling back when schema is absent", async () => {
  const db = { prepare() { throw new Error("schema not available"); } };
  const response = await worker.fetch(request("/api/tenant/context"), { DB: db });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "TENANT_CONTEXT_UNAVAILABLE");
});

test("tenant selection accepts a valid numeric Content-Length header", async () => {
  const { d1, sqlite } = makeD1();
  const body = JSON.stringify({ tenantId: "t2" });
  const response = await worker.fetch(new Request("https://preview.example/api/tenant/context/select", {
    method: "POST",
    headers: { cookie: `prochelia_session=${sessionToken}`, "content-type": "application/json", "content-length": String(new TextEncoder().encode(body).length) },
    body
  }), { DB: d1 });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).selectedTenantId, "t2");
  assert.equal(sqlite.prepare("SELECT tenant_id FROM tenant_session_context WHERE session_id='s1'").get().tenant_id, "t2");
});

test("tenant selection rejects a malformed declared Content-Length without mutation", async () => {
  const { d1, sqlite } = makeD1();
  const response = await worker.fetch(new Request("https://preview.example/api/tenant/context/select", {
    method: "POST",
    headers: { cookie: `prochelia_session=${sessionToken}`, "content-type": "application/json", "content-length": "not-a-number" },
    body: JSON.stringify({ tenantId: "t2" })
  }), { DB: d1 });
  assert.equal(response.status, 413);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM tenant_session_context").get().n, 0);
});

test("tenant selection rejects malformed JSON and oversized payloads before D1 mutation", async () => {
  const { d1, sqlite } = makeD1();
  const malformed = await worker.fetch(new Request("https://preview.example/api/tenant/context/select", {
    method: "POST", headers: { cookie: `prochelia_session=${sessionToken}`, "content-type": "application/json" }, body: "{"
  }), { DB: d1 });
  assert.equal(malformed.status, 400);
  const oversized = await worker.fetch(new Request("https://preview.example/api/tenant/context/select", {
    method: "POST", headers: { cookie: `prochelia_session=${sessionToken}`, "content-type": "application/json" },
    body: JSON.stringify({ tenantId: "t2", note: "x".repeat(3000) })
  }), { DB: d1 });
  assert.equal(oversized.status, 413);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM tenant_session_context").get().n, 0);
});
