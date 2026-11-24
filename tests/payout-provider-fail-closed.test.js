import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function payoutRequest(request, env) {");
const end = source.indexOf("\nasync function ", start + 1);
assert.ok(start >= 0 && end > start, "payout request handler must exist");
const handler = source.slice(start, end);

test("payout requests fail closed before schema setup, account lookup, or fund reservation without a PSP adapter", () => {
  const guard = handler.indexOf("if (!paymentsConfigured(env))");
  const schema = handler.indexOf("schemaColumnsReadinessResponse(env");
  const accountLookup = handler.indexOf("SELECT * FROM payment_accounts");
  const reservation = handler.indexOf("reservePayoutAtomically(env");
  assert.ok(guard >= 0, "PSP capability guard must exist");
  assert.ok(schema > guard, "guard precedes request-path schema setup");
  assert.ok(accountLookup > guard, "guard precedes payment account lookup");
  assert.ok(reservation > guard, "guard precedes any payout reservation");
  assert.match(handler.slice(guard, schema), /PAYOUT_PROVIDER_NOT_CONFIGURED/);
  assert.match(handler.slice(guard, schema), /write_enabled:false/);
  assert.match(handler.slice(guard, schema), /},503\)/);
});

test("the fail-closed payout guard does not depend on client-supplied provider or payout state", () => {
  const guard = handler.indexOf("if (!paymentsConfigured(env))");
  const schema = handler.indexOf("ensurePaymentSchema(env)");
  const guarded = handler.slice(guard, schema);
  assert.doesNotMatch(guarded, /body\?\.provider|body\?\.payouts_enabled|payload/);
});
