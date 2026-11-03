import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const endpoint = "https://prochelia-api-preview.rzem92.workers.dev/api/auth/logout";

// Middleware regression tests: these cases must be rejected before any DB access.
const noDatabase = {};

test("rejects a mutating browser request from an untrusted Origin before touching D1", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "POST",
    headers: {
      origin: "https://attacker.example",
      "content-type": "application/json"
    },
    body: "{}"
  }), noDatabase);

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
});

test("rejects cookie-authenticated state changes without Origin (CSRF defense)", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "POST",
    headers: {
      cookie: "prochelia_session=fake-session-token",
      "content-type": "application/json"
    },
    body: "{}"
  }), noDatabase);

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "CSRF_ORIGIN_REQUIRED");
});

test("rejects CORS preflight requesting a non-allowlisted header", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: {
      origin: "https://prochelia.pages.dev",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type, x-attacker-token"
    }
  }), noDatabase);

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "CORS_HEADER_NOT_ALLOWED");
});

test("rejects CORS preflight requesting an unsupported method", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: {
      origin: "https://prochelia.pages.dev",
      "access-control-request-method": "DELETE"
    }
  }), noDatabase);

  assert.equal(response.status, 405);
  assert.equal((await response.json()).error, "CORS_METHOD_NOT_ALLOWED");
});
