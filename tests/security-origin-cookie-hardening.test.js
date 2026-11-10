import test from "node:test";
import assert from "node:assert/strict";
import Worker from "../src/index.js";

const request = (path, { method = "GET", headers = {}, body } = {}) =>
  new Request("https://api.example.test" + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body })
  });

test("mutation without Origin is rejected before route work", async () => {
  const response = await Worker.fetch(request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "person@example.test", password: "ValidPass123!" })
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
});

test("mutation from an explicitly allowed Pages origin reaches the route", async () => {
  const response = await Worker.fetch(request("/api/auth/login", {
    method: "POST",
    headers: {
      origin: "https://prochelia.pages.dev",
      "content-type": "application/json"
    },
    body: JSON.stringify({ email: "person@example.test", password: "ValidPass123!" })
  }), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).database, false);
});

test("bootstrap without Origin requires the configured bootstrap bearer token", async () => {
  const denied = await Worker.fetch(request("/api/auth/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  }), { BOOTSTRAP_TOKEN: "test-bootstrap-token" });
  assert.equal(denied.status, 403);

  const accepted = await Worker.fetch(request("/api/auth/bootstrap", {
    method: "POST",
    headers: {
      authorization: "Bearer test-bootstrap-token",
      "content-type": "application/json"
    },
    body: "{}"
  }), { BOOTSTRAP_TOKEN: "test-bootstrap-token" });
  assert.equal(accepted.status, 503);
  assert.equal((await accepted.json()).database, false);
});

test("malformed percent-encoding in the session cookie is treated as unauthenticated", async () => {
  const DB = {
    prepare() {
      return {
        bind() {
          return { first: async () => null };
        }
      };
    }
  };
  const response = await Worker.fetch(request("/api/auth/me", {
    headers: { cookie: "prochelia_session=%E0%A4%A" }
  }), { DB });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).authenticated, false);
});

test("signed-webhook route is reachable without Origin and rejects an invalid signature", async () => {
  const DB = {
    prepare() {
      return {
        bind() { return this; },
        async first() { return null; },
        async run() { return { meta: { changes: 1 } }; },
        async all() { return { results: [] }; }
      };
    }
  };
  const response = await Worker.fetch(request("/api/payments/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-prochelia-signature": "invalid"
    },
    body: JSON.stringify({ id: "evt_test", type: "payment_succeeded", data: {} })
  }), { DB, PAYMENT_WEBHOOK_SECRET: "test-webhook-secret" });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "INVALID_WEBHOOK_SIGNATURE");
});
