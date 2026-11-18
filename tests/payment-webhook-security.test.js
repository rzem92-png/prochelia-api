import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { verifyWebhookSignature, webhookProviderForRequest, webhookReplayDecision, webhookEventInsertDecision } from "../src/index.js";

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

const stripeRequest = (body = payload, timestamp = Math.floor(Date.now() / 1000), extraSignatures = []) => {
  const digest = createHmac("sha256", secret).update(String(timestamp) + "." + body).digest("hex");
  return new Request("https://example.test/api/payments/webhook", {
    method: "POST",
    headers: { "stripe-signature": [`t=${timestamp}`, ...extraSignatures.map(value => `v1=${value}`), `v1=${digest}`].join(",") }
  });
};

test("Stripe native v1 signature accepts the exact raw body within the five-minute tolerance", async () => {
  assert.equal(await verifyWebhookSignature(stripeRequest(), { STRIPE_WEBHOOK_SECRET: secret }, payload), true);
});

test("Stripe native signature supports multiple v1 signatures during secret rotation", async () => {
  const request = stripeRequest(payload, Math.floor(Date.now() / 1000), ["0".repeat(64)]);
  assert.equal(await verifyWebhookSignature(request, { STRIPE_WEBHOOK_SECRET: secret }, payload), true);
});

test("Stripe native signature rejects altered payloads and stale or future timestamps", async () => {
  const now = Math.floor(Date.now() / 1000);
  const request = stripeRequest();
  assert.equal(await verifyWebhookSignature(request, { STRIPE_WEBHOOK_SECRET: secret }, payload + " "), false);
  assert.equal(await verifyWebhookSignature(stripeRequest(payload, now - 301), { STRIPE_WEBHOOK_SECRET: secret }, payload), false);
  assert.equal(await verifyWebhookSignature(stripeRequest(payload, now + 301), { STRIPE_WEBHOOK_SECRET: secret }, payload), false);
});

test("Stripe native signature rejects malformed and duplicate timestamps", async () => {
  const digest = createHmac("sha256", secret).update(String(Math.floor(Date.now() / 1000)) + "." + payload).digest("hex");
  for (const header of ["t=abc,v1=" + digest, "t=1,t=2,v1=" + digest, "t=" + Math.floor(Date.now() / 1000) + ",v1=bad", "t=" + Math.floor(Date.now() / 1000) + ",v1=" + "0".repeat(64) + "=trailing"]) {
    const request = new Request("https://example.test/api/payments/webhook", { method: "POST", headers: { "stripe-signature": header } });
    assert.equal(await verifyWebhookSignature(request, { STRIPE_WEBHOOK_SECRET: secret }, payload), false);
  }
});

test("invalid Stripe native header cannot fall back to a valid generic signature", async () => {
  const request = new Request("https://example.test/api/payments/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=bad,v1=" + "0".repeat(64), "x-prochelia-signature": sign() }
  });
  assert.equal(await verifyWebhookSignature(request, { STRIPE_WEBHOOK_SECRET: secret }, payload), false);
});


test("Stripe native signature requires a dedicated Stripe secret", async () => {
  const request = stripeRequest();
  assert.equal(await verifyWebhookSignature(request, { PAYMENT_WEBHOOK_SECRET: secret }, payload), false);
});


test("Stripe-signed event provider cannot be overridden by an untrusted payload field", () => {
  const request = stripeRequest();
  assert.equal(webhookProviderForRequest(request, { provider: "other-provider" }, {}), "stripe");
});

test("generic webhook provider resolution retains the configured legacy contract", () => {
  const request = new Request("https://example.test/api/payments/webhook", { method: "POST" });
  assert.equal(webhookProviderForRequest(request, { provider: "internal-provider" }, {}), "internal-provider");
});

test("webhook event idempotency accepts only an exact previously processed payload hash", () => {
  const samePayloadHash = sign();
  const differentPayloadHash = sign(payload + " ");
  assert.equal(webhookReplayDecision(samePayloadHash, samePayloadHash, 1), "DUPLICATE");
  assert.equal(webhookReplayDecision(samePayloadHash, samePayloadHash, 0), "PENDING");
  assert.equal(webhookReplayDecision(samePayloadHash, samePayloadHash, undefined), "PENDING");
  assert.equal(webhookReplayDecision(samePayloadHash, differentPayloadHash, 1), "CONFLICT");
  assert.equal(webhookReplayDecision(null, samePayloadHash, 1), "CONFLICT");
  assert.equal(webhookReplayDecision(samePayloadHash, undefined, 1), "CONFLICT");
});

test("webhook insert outcome requires a successful D1 result and an explicit single-row count", () => {
  assert.equal(webhookEventInsertDecision({ success: true, meta: { changes: 1 } }), "INSERTED");
  assert.equal(webhookEventInsertDecision({ success: true, meta: { changes: 0 } }), "EXISTS");
  assert.equal(webhookEventInsertDecision({ success: false, meta: { changes: 1 } }), "FAILED");
  assert.equal(webhookEventInsertDecision({ meta: { changes: 0 } }), "FAILED");
  assert.equal(webhookEventInsertDecision({ success: true, meta: {} }), "FAILED");
  assert.equal(webhookEventInsertDecision({ success: true, meta: { changes: 2 } }), "FAILED");
});
