import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { paymentsConfigured } from "../src/index.js";

test("PSP secrets alone never mark payment execution as configured", () => {
  assert.equal(paymentsConfigured({PAYMENT_WEBHOOK_SECRET:"configured",PAYMENT_PROVIDER:"stripe"}), false);
  assert.equal(paymentsConfigured({PAYMENT_WEBHOOK_SECRET:"configured",PAYMENT_PROVIDER:"psp_adapter"}), false);
  assert.equal(paymentsConfigured({}), false);
});

test("mission payment creation fails closed before any D1 access without a PSP adapter", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function createMissionPayment");
  const end = source.indexOf("\nasync function finalizeMissionPayment", start);
  assert.notEqual(start, -1, "createMissionPayment handler must exist");
  assert.notEqual(end, -1, "createMissionPayment handler boundary must exist");
  const body = source.slice(start, end);
  assert.match(body, /PSP_ADAPTER_NOT_IMPLEMENTED/);
  assert.doesNotMatch(body, /ensurePaymentSchema|INSERT INTO payment_transactions|\.run\(/);
});
