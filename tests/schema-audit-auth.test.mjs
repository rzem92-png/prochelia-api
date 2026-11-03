import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const base = "https://prochelia-api-preview.rzem92.workers.dev";

// Minimal D1 mock for the production mutation rate-limit middleware.
// DDL/cleanup statements are no-ops; only the atomic limiter query returns a counter.
function loginTestEnv() {
  return {
    DB: {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() {
            if (String(sql).includes("RETURNING request_count")) return { request_count: 1 };
            return null;
          },
          async run() { return { meta: { changes: 0 } }; },
          async all() { return { results: [] }; }
        };
      },
      async batch() { return []; }
    }
  };
}

test("malformed session cookie fails closed without crashing auth", async () => {
  const response = await worker.fetch(
    new Request(base + "/api/auth/me", {
      method: "GET",
      headers: { cookie: "prochelia_session=%E0%A4%A" }
    }),
    {}
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

for (const path of ["/api/core/schema", "/api/missions/schema"]) {
  test(`protects sensitive schema audit endpoint ${path} from unauthenticated access`, async () => {
    const response = await worker.fetch(new Request(base + path, { method: "GET" }), {});
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "UNAUTHENTICATED");
  });
}

test("login rejects oversized JSON payloads before parsing", async () => {
  const env = loginTestEnv();
  const response = await worker.fetch(
    new Request(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "CF-Connecting-IP": "203.0.113.10" },
      body: JSON.stringify({ email: "user@example.com", password: "A".repeat(5000) })
    }),
    env
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "INVALID_CREDENTIALS");
});

test("login returns generic credentials error for unknown account", async () => {
  const env = loginTestEnv();
  const response = await worker.fetch(
    new Request(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "CF-Connecting-IP": "203.0.113.11" },
      body: JSON.stringify({ email: "nobody@example.com", password: "ValidPassword123" })
    }),
    env
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "INVALID_CREDENTIALS");
});
