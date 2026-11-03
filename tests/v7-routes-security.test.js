import test from "node:test";
import assert from "node:assert/strict";
import { handleV7Route } from "../src/v7-routes.js";

const denied = [
  "/api/v7/check/account",
  "/api/v7/check/permissions",
  "/api/v7/check/intervenant",
  "/api/v7/check/document",
  "/api/v7/check/expiration",
  "/api/v7/check/transport",
  "/api/v7/check/mission",
  "/api/v7/check/mission-transition",
  "/api/v7/check/availability",
  "/api/v7/check/conflict",
  "/api/v7/check/pricing",
  "/api/v7/check/qr",
  "/api/v7/check/payment",
  "/api/v7/check/pre-mission",
  "/api/v7/security/idempotency",
  "/api/v7/security/audit",
  "/api/v7/finance/calculate",
  "/api/v7/strategy/indicators"
];

for (const path of denied) {
  test(`unauthenticated authority route fails closed: ${path}`, async () => {
    const response = await handleV7Route(
      new Request("https://example.test" + path, { method: "POST", body: "{}" }),
      {},
      path
    );
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "AUTHENTICATED_SERVER_VALIDATION_REQUIRED");
  });
}

test("the helper status endpoint remains informational", async () => {
  const path = "/api/v7/status";
  const response = await handleV7Route(
    new Request("https://example.test" + path, { method: "GET" }),
    {},
    path
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ready");
});

for (const path of denied) {
  test(`blocked authority route denies GET as well: ${path}`, async () => {
    const response = await handleV7Route(
      new Request("https://example.test" + path, { method: "GET" }),
      {},
      path
    );
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    const body = await response.json();
    assert.equal(body.error, "AUTHENTICATED_SERVER_VALIDATION_REQUIRED");
  });
}

test("blocked authority route is not affected by caller-supplied validation claims", async () => {
  const path = "/api/v7/check/payment";
  const forged = {
    authenticated: true,
    role: "admin",
    paymentVerified: true,
    signatureValid: true,
    missionValidated: true
  };
  const response = await handleV7Route(
    new Request("https://example.test" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(forged)
    }),
    {},
    path
  );
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "AUTHENTICATED_SERVER_VALIDATION_REQUIRED");
});
