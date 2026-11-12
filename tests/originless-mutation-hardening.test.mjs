import test from "node:test";
import assert from "node:assert/strict";
import Worker from "../src/index.js";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

const request = (path, { method = "GET", headers = {}, body } = {}) =>
  new Request("https://api.example.test" + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body })
  });

test("originless state-changing requests are rejected before route work", async () => {
  const response = await Worker.fetch(request("/api/missions/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
});

test("an Origin is not trusted when CORS_ORIGIN is missing", async () => {
  const response = await Worker.fetch(request("/api/auth/login", {
    method: "POST",
    headers: {
      origin: "https://prochelia.pages.dev",
      "content-type": "application/json"
    },
    body: JSON.stringify({ email: "person@example.test", password: "ValidPass123!" })
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
});

test("an explicitly configured exact Origin passes the origin gate", async () => {
  const response = await Worker.fetch(request("/api/auth/login", {
    method: "POST",
    headers: {
      origin: "https://prochelia.pages.dev",
      "content-type": "application/json"
    },
    body: JSON.stringify({ email: "person@example.test", password: "ValidPass123!" })
  }), { CORS_ORIGIN: "https://prochelia.pages.dev" });
  assert.notEqual(response.status, 403);
});

test("originless bootstrap requires the exact configured bearer token", async () => {
  const denied = await Worker.fetch(request("/api/auth/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  }), { BOOTSTRAP_TOKEN: "test-bootstrap-token" });
  assert.equal(denied.status, 403);

  const allowedPastOriginGate = await Worker.fetch(request("/api/auth/bootstrap", {
    method: "POST",
    headers: {
      authorization: "Bearer test-bootstrap-token",
      "content-type": "application/json"
    },
    body: "{}"
  }), { BOOTSTRAP_TOKEN: "test-bootstrap-token" });
  assert.notEqual(allowedPastOriginGate.status, 403);
});

test("payment webhook verifies its signature before any D1 schema access", () => {
  const start = source.indexOf("async function paymentWebhook(request, env)");
  const end = source.indexOf("\nasync function ", start + 1);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.ok(handler.indexOf("verifyWebhookSignature(request,env,raw)") < handler.indexOf("ensurePaymentSchema(env)"));
});

test("originless webhook mutations are not implicitly exempted by the generic origin guard", () => {
  const start = source.indexOf("function originlessBootstrapAllowed");
  const end = source.indexOf("\n\n", start);
  assert.ok(start >= 0 && end > start);
  const helper = source.slice(start, end);
  assert.match(helper, /url\.pathname==='\/api\/auth\/bootstrap'/);
  assert.doesNotMatch(helper, /payments\/webhook/);
});
