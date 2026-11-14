import test from "node:test";
import assert from "node:assert/strict";
import { paymentsConfigured } from "../src/index.js";

test("PSP secrets alone never mark payment execution as configured", () => {
  assert.equal(paymentsConfigured({PAYMENT_WEBHOOK_SECRET:"configured",PAYMENT_PROVIDER:"stripe"}), false);
  assert.equal(paymentsConfigured({PAYMENT_WEBHOOK_SECRET:"configured",PAYMENT_PROVIDER:"psp_adapter"}), false);
  assert.equal(paymentsConfigured({}), false);
});
