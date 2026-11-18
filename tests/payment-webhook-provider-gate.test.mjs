import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { paymentWebhook, webhookProviderForRequest } from "../src/index.js";

globalThis.crypto ??= webcrypto;

test("generic HMAC cannot authenticate a Stripe provider without Stripe's native signature", async () => {
  const secret = "synthetic-webhook-secret-not-production";
  const payload = JSON.stringify({ id: "evt_synthetic_1", type: "customer.updated", provider: "stripe", data: {} });
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  let databaseCalls = 0;
  const env = {
    PAYMENT_WEBHOOK_SECRET: secret,
    PAYMENT_PROVIDER: "stripe",
    DB: {
      prepare() {
        databaseCalls += 1;
        throw new Error("Webhook must not touch D1 without a configured PSP adapter");
      }
    }
  };
  const request = new Request("https://api.example.test/api/payments/webhook", {
    method: "POST",
    headers: { "x-prochelia-signature": signature, "content-type": "application/json" },
    body: payload
  });
  const response = await paymentWebhook(request, env);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "PROVIDER_SIGNATURE_REQUIRED");
  assert.equal(databaseCalls, 0);
});


test("untrusted webhook JSON cannot choose the PSP provider", () => {
  const request = new Request("https://api.example.test/api/payments/webhook", {
    method: "POST",
    headers: { "x-prochelia-signature": "0".repeat(43) }
  });
  assert.equal(
    webhookProviderForRequest(request, { provider: "stripe" }, { PAYMENT_PROVIDER: "psp_adapter" }),
    "psp_adapter"
  );
});

test("valid Stripe-native webhook remains blocked before D1 until the PSP adapter is implemented", async () => {
  const secret = "synthetic-stripe-secret-not-production";
  const payload = JSON.stringify({
    id: "evt_synthetic_stripe_1",
    type: "customer.updated",
    provider: "untrusted-provider",
    data: {}
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(String(timestamp) + "." + payload)
    .digest("hex");
  let databaseCalls = 0;
  const env = {
    STRIPE_WEBHOOK_SECRET: secret,
    PAYMENT_WEBHOOK_SECRET: "different-generic-secret-not-production",
    PAYMENT_PROVIDER: "stripe",
    DB: {
      prepare() {
        databaseCalls += 1;
        throw new Error("No D1 access is allowed before a PSP adapter is configured");
      }
    }
  };
  const request = new Request("https://api.example.test/api/payments/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": `t=${timestamp},v1=${signature}`,
      "content-type": "application/json"
    },
    body: payload
  });
  const response = await paymentWebhook(request, env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "PAYMENT_PROVIDER_NOT_CONFIGURED");
  assert.equal(databaseCalls, 0);
});

test("invalid Stripe header cannot be rescued by a valid generic HMAC at the HTTP handler", async () => {
  const secret = "synthetic-generic-secret-not-production";
  const payload = JSON.stringify({ id: "evt_synthetic_stripe_2", type: "customer.updated" });
  const genericSignature = createHmac("sha256", secret).update(payload).digest("base64url");
  let databaseCalls = 0;
  const env = {
    STRIPE_WEBHOOK_SECRET: secret,
    PAYMENT_WEBHOOK_SECRET: secret,
    DB: {
      prepare() {
        databaseCalls += 1;
        throw new Error("Invalid signatures must be rejected before D1 access");
      }
    }
  };
  const request = new Request("https://api.example.test/api/payments/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": "t=invalid,v1=" + "0".repeat(64),
      "x-prochelia-signature": genericSignature,
      "content-type": "application/json"
    },
    body: payload
  });
  const response = await paymentWebhook(request, env);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "INVALID_WEBHOOK_SIGNATURE");
  assert.equal(databaseCalls, 0);
});
