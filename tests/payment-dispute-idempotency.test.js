import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function openPaymentDispute");
const end = source.indexOf("\\nasync function paymentAdminResolve", start);
const body = source.slice(start, end);

test("dispute creation is guarded against a second open dispute for the same transaction", () => {
  assert.match(body, /NOT EXISTS \\(SELECT 1 FROM payment_disputes WHERE transaction_id=\\? AND status IN \\('open','pending'\\)\\)/);
  assert.match(body, /results\\?\\.\\[1\\]\\?\\.meta/);
});
