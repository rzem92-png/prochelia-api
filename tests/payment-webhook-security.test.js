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


const stripeSecret = "whsec_synthetic_test_secret_only";
const stripeTimestamp = 1795536000;
const stripeSign = (body = payload, timestamp = stripeTimestamp) =>
  createHmac("sha256", stripeSecret).update(`${timestamp}.${body}`).digest("hex");
const stripeRequest = (header) => new Request("https://example.test/api/payments/webhook", {
  method: "POST",
  headers: { "Stripe-Signature": header }
});

test("Stripe webhook verifies the native t/v1 signature over timestamp and exact raw body", async () => {
  const signature = stripeSign();
  assert.equal(await verifyWebhookSignature(
    stripeRequest(`t=${stripeTimestamp},v1=${signature}`),
    { PAYMENT_PROVIDER: "stripe", STRIPE_WEBHOOK_SECRET: stripeSecret },
    payload,
    stripeTimestamp
  ), true);
});

test("Stripe webhook accepts any valid v1 signature when multiple signatures are supplied", async () => {
  const signature = stripeSign();
  const header = `t=${stripeTimestamp},v0=ignored,v1=${"0".repeat(64)},v1=${signature}`;
  assert.equal(await verifyWebhookSignature(
    stripeRequest(header),
    { PAYMENT_PROVIDER: "stripe", STRIPE_WEBHOOK_SECRET: stripeSecret },
    payload,
    stripeTimestamp
  ), true);
});

test("Stripe webhook rejects modified payloads, malformed headers and absent Stripe secrets", async () => {
  const signature = stripeSign();
  const env = { PAYMENT_PROVIDER: "stripe", STRIPE_WEBHOOK_SECRET: stripeSecret };
  assert.equal(await verifyWebhookSignature(stripeRequest(`t=${stripeTimestamp},v1=${signature}`), env, payload + " ", stripeTimestamp), false);
  assert.equal(await verifyWebhookSignature(stripeRequest(`t=x,v1=${signature}`), env, payload, stripeTimestamp), false);
  assert.equal(await verifyWebhookSignature(stripeRequest(`t=${stripeTimestamp}`), env, payload, stripeTimestamp), false);
  assert.equal(await verifyWebhookSignature(stripeRequest(`t=${stripeTimestamp},v1=${signature}`), { PAYMENT_PROVIDER: "stripe" }, payload, stripeTimestamp), false);
});

test("Stripe webhook rejects timestamps outside the five-minute tolerance, including future timestamps", async () => {
  const signature = stripeSign();
  const env = { PAYMENT_PROVIDER: "stripe", STRIPE_WEBHOOK_SECRET: stripeSecret };
  const header = `t=${stripeTimestamp},v1=${signature}`;
  assert.equal(await verifyWebhookSignature(stripeRequest(header), env, payload, stripeTimestamp + 301), false);
  assert.equal(await verifyWebhookSignature(stripeRequest(header), env, payload, stripeTimestamp - 301), false);
});

test("Stripe provider never falls back to the generic custom HMAC header", async () => {
  const genericSignature = sign();
  const request = new Request("https://example.test/api/payments/webhook", {
    method: "POST",
    headers: { "x-prochelia-signature": genericSignature }
  });
  assert.equal(await verifyWebhookSignature(
    request,
    { PAYMENT_PROVIDER: "stripe", PAYMENT_WEBHOOK_SECRET: secret, STRIPE_WEBHOOK_SECRET: stripeSecret },
    payload,
    stripeTimestamp
  ), false);
});
