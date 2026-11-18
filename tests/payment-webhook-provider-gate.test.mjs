import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { paymentWebhook } from "../src/index.js";

globalThis.crypto ??= webcrypto;

test("signed non-settlement webhook is rejected before schema creation without a PSP adapter", async () => {
  const secret = "synthetic-webhook-secret-not-production";
  const payload = JSON.stringify({ id: "evt_synthetic_1", type: "customer.updated", data: {} });
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
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "PAYMENT_PROVIDER_NOT_CONFIGURED");
  assert.equal(databaseCalls, 0);
});
