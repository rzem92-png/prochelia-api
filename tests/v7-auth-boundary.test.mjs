import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const origin = "https://prochelia.pages.dev";
// Isolated D1 test double: supplies only the binding required by the
// request-security/rate-limit middleware. It has no persistent state and
// cannot reach any Cloudflare D1 database.
const noSessionDb = {
  prepare(sql) {
    return {
      bind() { return this; },
      async first() {
        return String(sql).includes('security_rate_limits') ? { request_count: 1 } : null;
      },
      async run() { return { success: true }; }
    };
  }
};

test("private V7 audit endpoint rejects unauthenticated callers before route logic", async () => {
  const response = await worker.fetch(new Request("https://api.example/api/v7/security/audit", {
    method: "POST",
    headers: { origin, "cf-connecting-ip": "203.0.113.10", "content-type": "application/json" },
    body: JSON.stringify({ action: "ATTEMPT" })
  }), { DB: noSessionDb });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("public V7 status endpoint remains available without a session", async () => {
  const response = await worker.fetch(new Request("https://api.example/api/v7/status"), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test("private mission and permission validators reject unauthenticated requests", async () => {
  const paths = [
    "/api/v7/check/permissions",
    "/api/v7/check/mission",
    "/api/v7/check/mission-transition"
  ];

  for (const path of paths) {
    const response = await worker.fetch(new Request(`https://api.example${path}`, {
      method: "POST",
      headers: {
        origin,
        "cf-connecting-ip": "203.0.113.11",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        role: "gerante",
        currentStatus: "pending",
        nextStatus: "completed",
        mission: { id: "mission-private-test" }
      })
    }), { DB: noSessionDb });

    assert.equal(response.status, 401, `${path} must require a session`);
    assert.equal((await response.json()).error, "UNAUTHENTICATED");
  }
});

test("mission validation endpoint remains closed until ownership-bound server validation is implemented", async () => {
  const response = await worker.fetch(new Request("https://api.example/api/missions/validate", {
    method: "POST",
    headers: {
      origin,
      "cf-connecting-ip": "203.0.113.12",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      mission_id: "mission-guessable-id",
      client_id: "victim-client",
      intervenant_id: "victim-provider"
    })
  }), { DB: noSessionDb });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "AUTHENTICATED_VALIDATION_REQUIRED");
});

test("V7 JSON validators reject oversized request bodies before parsing", async () => {
  const response = await worker.fetch(new Request("https://api.example/api/v7/check/email", {
    method: "POST",
    headers: { origin, "cf-connecting-ip": "203.0.113.13", "content-type": "application/json" },
    body: JSON.stringify({ email: "x@example.com", padding: "x".repeat(20_000) })
  }), { DB: noSessionDb });

  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, "TOO_LARGE");
});

test("V7 JSON validators return 400 for malformed JSON instead of an internal error", async () => {
  const response = await worker.fetch(new Request("https://api.example/api/v7/check/email", {
    method: "POST",
    headers: { origin, "cf-connecting-ip": "203.0.113.14", "content-type": "application/json" },
    body: "{not-json"
  }), { DB: noSessionDb });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_JSON_BODY");
});
