import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { verifyWebhookSignature } from "../src/index.js";

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

test("Stripe native timestamped signatures are rejected until a Stripe-specific adapter is implemented", async () => {
  const timestamp = "1794992400";
  const stripeDigest = createHmac("sha256", secret).update(timestamp + "." + payload).digest("hex");
  const request = new Request("https://example.test/api/payments/webhook", {
    method: "POST",
    headers: { "stripe-signature": `t=${timestamp},v1=${stripeDigest}` }
  });
  assert.equal(await verifyWebhookSignature(request, { PAYMENT_WEBHOOK_SECRET: secret }, payload), false);
});
