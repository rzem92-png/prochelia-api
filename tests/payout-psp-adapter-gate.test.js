import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function payoutRequest");
const end = source.indexOf("\nfunction constantTimeStringEqual", start);
const body = source.slice(start, end);

test("payout request fails closed before schema access or wallet reservation without a PSP adapter", () => {
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.ok(body.includes("PSP_PAYOUT_ADAPTER_NOT_IMPLEMENTED"));
  assert.ok(!body.includes("ensurePaymentSchema"));
  assert.ok(!body.includes("reservePayoutAtomically"));
  assert.ok(!body.includes("INSERT INTO payout_requests"));
});
