import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const endpoint = "https://prochelia-api-preview.rzem92.workers.dev/api/auth/bootstrap";
const TOKEN = "test-bootstrap-secret";

function bootstrapEnv({ token = TOKEN, users = [] } = {}) {
  const state = { users: [...users], rateCount: 0, bootstrapWrites: 0 };
  const env = {
    BOOTSTRAP_TOKEN: token,
    DB: {
      prepare(sql) {
        const query = String(sql);
        let values = [];
        const stmt = {
          bind(...args) { values = args; return this; },
          async first() {
            if (query.includes("RETURNING request_count")) return { request_count: ++state.rateCount };
            if (query.includes("SELECT COUNT(*) AS total FROM users")) return { total: state.users.length };
            return null;
          },
          async run() {
            if (query.includes("INSERT INTO users") && query.includes("WHERE NOT EXISTS")) {
              state.bootstrapWrites++;
              if (state.users.length !== 0) return { meta: { changes: 0 } };
              state.users.push({ id: values[0], email: values[1], role: "gerante" });
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          },
          async all() { return { results: [] }; }
        };
        return stmt;
      },
      async batch() { return []; }
    }
  };
  return { env, state };
}

function request({ authorization = `Bearer ${TOKEN}`, body = {
  email: "owner@example.com", first_name: "Test", last_name: "Owner", password: "StrongPassword123"
} } = {}) {
  const headers = { "content-type": "application/json", "CF-Connecting-IP": "203.0.113.40" };
  if (authorization !== null) headers.authorization = authorization;
  return new Request(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
}

test("bootstrap fails closed when token is not configured", async () => {
  const { env } = bootstrapEnv({ token: null });
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "BOOTSTRAP_NOT_CONFIGURED");
});

test("bootstrap rejects missing or incorrect bearer token before account creation", async () => {
  for (const authorization of [null, "Bearer wrong-token"]) {
    const { env, state } = bootstrapEnv();
    const response = await worker.fetch(request({ authorization }), env);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "UNAUTHORIZED");
    assert.equal(state.users.length, 0);
    assert.equal(state.bootstrapWrites, 0);
  }
});

test("bootstrap rejects oversized and malformed payloads without writing users", async () => {
  for (const body of [
    { email: "owner@example.com", first_name: "A", last_name: "B", password: "x".repeat(5000) },
    "not-json"
  ]) {
    const { env, state } = bootstrapEnv();
    const req = new Request(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", "CF-Connecting-IP": "203.0.113.41" },
      body: typeof body === "string" ? body : JSON.stringify(body)
    });
    const response = await worker.fetch(req, env);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "INVALID_BOOTSTRAP_DATA");
    assert.equal(state.users.length, 0);
    assert.equal(state.bootstrapWrites, 0);
  }
});

test("bootstrap creates one manager and refuses token reuse", async () => {
  const { env, state } = bootstrapEnv();
  const first = await worker.fetch(request(), env);
  assert.equal(first.status, 201);
  const result = await first.json();
  assert.equal(result.created, true);
  assert.equal(result.user.role, "gerante");
  assert.equal(state.users.length, 1);

  const second = await worker.fetch(request(), env);
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error, "BOOTSTRAP_ALREADY_USED");
  assert.equal(state.users.length, 1);
});
