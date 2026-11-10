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

test("signed webhook handler verifies signatures before accessing payment schema", async () => {
  const source = await (await import("node:fs/promises")).readFile(
    new URL("../src/index.js", import.meta.url), "utf8"
  );
  const handlerStart = source.indexOf("async function paymentWebhook(request, env)");
  const handlerEnd = source.indexOf("\nasync function ", handlerStart + 1);
  const handler = source.slice(handlerStart, handlerEnd);
  assert.ok(handlerStart >= 0);
  assert.ok(handler.indexOf("verifyWebhookSignature(request,env,raw)") < handler.indexOf("ensurePaymentSchema(env)"));
  assert.match(source, /url\.pathname === '\/api\/payments\/webhook'[\s\S]*?PAYMENT_WEBHOOK_DISABLED_PENDING_REVIEW/);
  assert.doesNotMatch(source, /return paymentWebhook\(request,env\)/);
  assert.match(source, /noOriginWebhook = preflightMethod === 'POST' && preflightPath === '\/api\/payments\/webhook'/);
});

test("payment webhook endpoint returns an explicit fail-closed response", async () => {
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
    headers: { "content-type": "application/json" },
    body: "{}"
  }), { DB });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "PAYMENT_WEBHOOK_DISABLED_PENDING_REVIEW");
});

test("production readiness stays closed while payment webhooks are deliberately disabled", async () => {
  const source = await (await import("node:fs/promises")).readFile(
    new URL("../src/index.js", import.meta.url), "utf8"
  );
  const start = source.indexOf("async function strictProductionAudit");
  const end = source.indexOf("\\nconst __procheliaProductionSafetyHandle", start);
  assert.ok(start >= 0);
  assert.ok(end > start);
  const audit = source.slice(start, end);
  assert.match(audit, /PAYMENT_WEBHOOK_ATOMICITY/);
  assert.match(audit, /status:'NOT_READY'/);
  assert.ok(audit.includes("blockingCodes=new Set(['PAYMENT_WEBHOOK_ATOMICITY'"));
  assert.match(source, /PAYMENT_WEBHOOK_DISABLED_PENDING_REVIEW/);
});
