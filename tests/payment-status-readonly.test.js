import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function paymentStatus");
const end = source.indexOf("\nasync function createMissionPayment", start);
const body = source.slice(start, end);

test("payment status GET performs no schema creation or wallet writes", () => {
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.doesNotMatch(body, /ensurePaymentSchema/);
  assert.doesNotMatch(body, /INSERT INTO/);
  assert.doesNotMatch(body, /\.run\(/);
  assert.match(body, /PAYMENT_SCHEMA_NOT_READY/);
  assert.match(body, /wallet\?\.available_cents/);
});
