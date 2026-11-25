import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { verifyWebhookSignature, readBoundedWebhookBody } from "../src/index.js";

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
\ntest("webhook body reader preserves valid UTF-8 payload bytes for HMAC", async () => {
  const request = new Request("https://example.test/api/payments/webhook", { method: "POST", body: payload });
  const result = await readBoundedWebhookBody(request);
  assert.deepEqual(result, { ok: true, raw: payload });
});

test("webhook body reader rejects an oversized declared length before reading", async () => {
  const request = new Request("https://example.test/api/payments/webhook", {
    method: "POST",
    headers: { "content-length": "9" },
    body: "12345678"
  });
  assert.deepEqual(await readBoundedWebhookBody(request, 8), { ok: false, error: "WEBHOOK_BODY_TOO_LARGE" });
});

test("webhook body reader enforces the byte limit while streaming", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("12345"));
      controller.enqueue(new TextEncoder().encode("67890"));
      controller.close();
    }
  });
  const request = new Request("https://example.test/api/payments/webhook", { method: "POST", body, duplex: "half" });
  assert.deepEqual(await readBoundedWebhookBody(request, 8), { ok: false, error: "WEBHOOK_BODY_TOO_LARGE" });
});

test("webhook body reader rejects malformed UTF-8", async () => {
  const request = new Request("https://example.test/api/payments/webhook", { method: "POST", body: new Uint8Array([0xff]) });
  assert.deepEqual(await readBoundedWebhookBody(request), { ok: false, error: "INVALID_WEBHOOK_ENCODING" });
});
\ntest("webhook body reader preserves a UTF-8 BOM for exact HMAC payloads", async () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(payload)]);
  const request = new Request("https://example.test/api/payments/webhook", { method: "POST", body: bytes });
  const result = await readBoundedWebhookBody(request);
  assert.deepEqual(result, { ok: true, raw: "\\uFEFF" + payload });
});
