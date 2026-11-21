import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, webcrypto } from "node:crypto";
import worker, { deliverSecurityCodes, paymentWebhook, readBoundedWebhookBody, verifyWebhookSignature } from "../src/index.js";

globalThis.crypto ??= webcrypto;

const secret = "test-webhook-secret-not-for-production";
const payload = JSON.stringify({ id: "evt_test_001", type: "payment_succeeded", data: { transaction_id: "tx_test_001" } });
const sign = (body = payload) => createHmac("sha256", secret).update(body).digest("base64url");

test("webhook signature rejects requests when no secret is configured", async () => {
  const request = new Request("https://example.test/api/payments/webhook", { method: "POST" });
  assert.equal(await verifyWebhookSignature(request, {}, payload), false);
});

test("webhook signature rejects a missing signature", async () => {
  const request = new Request("https://example.test/api/payments/webhook", { method: "POST" });
  assert.equal(await verifyWebhookSignature(request, { PAYMENT_WEBHOOK_SECRET: secret }, payload), false);
});

test("webhook signature rejects malformed and incorrect signatures", async () => {
  for (const signature of ["bad", "sha256=bad", "A".repeat(43)]) {
    const request = new Request("https://example.test/api/payments/webhook", { method: "POST", headers: { "x-prochelia-signature": signature } });
    assert.equal(await verifyWebhookSignature(request, { PAYMENT_WEBHOOK_SECRET: secret }, payload), false);
  }
});

test("webhook signature accepts the exact HMAC-SHA256 base64url digest", async () => {
  const request = new Request("https://example.test/api/payments/webhook", { method: "POST", headers: { "x-prochelia-signature": sign() } });
  assert.equal(await verifyWebhookSignature(request, { PAYMENT_WEBHOOK_SECRET: secret }, payload), true);
});

test("webhook signature accepts the sha256= prefix and rejects a changed payload", async () => {
  const request = new Request("https://example.test/api/payments/webhook", { method: "POST", headers: { "x-webhook-signature": `sha256=${sign()}` } });
  assert.equal(await verifyWebhookSignature(request, { PAYMENT_WEBHOOK_SECRET: secret }, payload), true);
  assert.equal(await verifyWebhookSignature(request, { PAYMENT_WEBHOOK_SECRET: secret }, payload + " "), false);
});


const stripeSecret = "whsec_test_secret_for_prochelia_webhook_2026";
const stripePayload = JSON.stringify({ id: "evt_stripe_test_001", type: "customer.updated", data: {} });
const stripeSign = (body, timestamp, secret = stripeSecret) =>
  createHmac("sha256", secret).update(String(timestamp) + "." + body).digest("hex");
const stripeRequest = (body, timestamp, signature = stripeSign(body, timestamp)) =>
  new Request("https://example.test/api/payments/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=" + timestamp + ",v1=" + signature },
    body
  });

test("Stripe native webhook verifies HMAC over timestamp and exact raw body", async () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const request = stripeRequest(stripePayload, timestamp);
  assert.equal(await verifyWebhookSignature(request, { STRIPE_WEBHOOK_SECRET: stripeSecret }, stripePayload), true);
  assert.equal(await verifyWebhookSignature(request, { STRIPE_WEBHOOK_SECRET: stripeSecret }, stripePayload + " "), false);
});

test("Stripe native webhook rejects stale, future, duplicate-timestamp and malformed signatures", async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const timestamp of [now - 301, now + 301]) {
    assert.equal(await verifyWebhookSignature(stripeRequest(stripePayload, timestamp), { STRIPE_WEBHOOK_SECRET: stripeSecret }, stripePayload), false);
  }
  const signature = stripeSign(stripePayload, now);
  const duplicateTimestamp = new Request("https://example.test/api/payments/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=" + now + ",t=" + now + ",v1=" + signature },
    body: stripePayload
  });
  assert.equal(await verifyWebhookSignature(duplicateTimestamp, { STRIPE_WEBHOOK_SECRET: stripeSecret }, stripePayload), false);
  assert.equal(await verifyWebhookSignature(stripeRequest(stripePayload, now, "not-a-signature"), { STRIPE_WEBHOOK_SECRET: stripeSecret }, stripePayload), false);
});

test("a present Stripe header never falls back to a valid generic HMAC", async () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const request = new Request("https://example.test/api/payments/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": "t=" + timestamp + ",v1=" + "0".repeat(64),
      "x-prochelia-signature": sign(stripePayload)
    },
    body: stripePayload
  });
  assert.equal(await verifyWebhookSignature(request, { PAYMENT_WEBHOOK_SECRET: secret }, stripePayload), false);
});

test("bounded webhook reader rejects an oversized body before parsing", async () => {
  const request = new Request("https://example.test/api/payments/webhook", {
    method: "POST",
    body: "x".repeat(1_048_577)
  });
  const result = await readBoundedWebhookBody(request);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "too_large");
});

test("validly signed Stripe events remain blocked before any financial write without a PSP adapter", async () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const response = await paymentWebhook(stripeRequest(stripePayload, timestamp), { STRIPE_WEBHOOK_SECRET: stripeSecret });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error, "PAYMENT_PROVIDER_NOT_CONFIGURED");
  assert.equal(body.write_enabled, false);
});

test("the canonical Worker router exposes the webhook endpoint as POST-only", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/payments/webhook"), {});
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});


test("mission-code delivery webhook uses a keyed HMAC-SHA256 over the exact JSON body", async () => {
  const deliverySecret = "a-distinct-test-secret-for-mission-code-webhook";
  const payload = {
    mission_id: "mission-synthetic-001",
    client_id: "client-synthetic-001",
    arrival_code: "123456",
    arrival_expires_at: "2026-11-21T08:00:00.000Z",
    end_code: "654321",
    end_expires_at: "2026-11-21T08:15:00.000Z"
  };
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(null, { status: 204 });
  };
  try {
    const result = await deliverSecurityCodes({
      SECURITY_CODE_WEBHOOK: "https://receiver.example.test/security-codes",
      SECURITY_CODE_WEBHOOK_SECRET: deliverySecret
    }, payload);
    assert.deepEqual(result, { ok: true, channel: "authenticated_notification_webhook" });
    assert.ok(captured);
    assert.equal(captured.url, "https://receiver.example.test/security-codes");
    assert.equal(captured.init.headers["content-type"], "application/json");
    const expected = createHmac("sha256", deliverySecret).update(captured.init.body).digest("base64url");
    const legacyUnkeyedDigest = createHash("sha256").update(deliverySecret + "." + captured.init.body).digest("base64url");
    assert.equal(captured.init.headers["x-prochelia-signature"], expected);
    assert.notEqual(captured.init.headers["x-prochelia-signature"], legacyUnkeyedDigest);
    assert.equal(captured.init.body.includes(deliverySecret), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
