import test from "node:test";
import assert from "node:assert/strict";
import { paymentsConfigured } from "../src/index.js";

test("provider name and webhook secret alone never enable payments", () => {
  assert.equal(paymentsConfigured({
    PAYMENT_PROVIDER: "stripe",
    PAYMENT_WEBHOOK_SECRET: "configured-test-secret"
  }), false);
});

test("payments remain disabled when configuration is absent or partial", () => {
  assert.equal(paymentsConfigured({}), false);
  assert.equal(paymentsConfigured({ PAYMENT_PROVIDER: "stripe" }), false);
  assert.equal(paymentsConfigured({ PAYMENT_WEBHOOK_SECRET: "configured-test-secret" }), false);
});
