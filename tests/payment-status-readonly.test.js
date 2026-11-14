import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function paymentStatus(request, env) {");
const end = source.indexOf("\nasync function ", start + 20);
const body = source.slice(start, end);

test("payment status GET is read-only and never creates schema or wallet rows", () => {
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(body, /sqlite_master/);
  assert.match(body, /payments_configured:false/);
  assert.doesNotMatch(body, /ensurePaymentSchema|INSERT INTO|UPDATE |DELETE FROM|\.run\(/);
});

test("payment status safely returns zero balances when wallet or payment tables are absent", () => {
  assert.match(body, /wallet\?\.available_cents \|\| 0/);
  assert.match(body, /tables\.has\('wallets'\)/);
  assert.match(body, /tables\.has\('payment_accounts'\)/);
  assert.match(body, /tables\.has\('payout_requests'\)/);
});
