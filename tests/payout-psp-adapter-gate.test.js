import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function payoutRequest");
const end = source.indexOf("\nasync function", start + 10);
const body = source.slice(start, end);

test("payout request is rejected before D1 schema access or wallet reservation without a PSP adapter", () => {
  assert.notEqual(start, -1);
  assert.match(body, /PSP_PAYOUT_ADAPTER_NOT_IMPLEMENTED/);
  assert.ok(body.indexOf("PSP_PAYOUT_ADAPTER_NOT_IMPLEMENTED") < body.indexOf("await ensurePaymentSchema(env)"));
  assert.ok(body.indexOf("PSP_PAYOUT_ADAPTER_NOT_IMPLEMENTED") < body.indexOf("reservePayoutAtomically"));
});
