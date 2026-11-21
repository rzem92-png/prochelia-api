import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function payoutRequest(request, env) {");
const end = source.indexOf("\nfunction constantTimeStringEqual(", start);
assert.ok(start >= 0 && end > start, "payout request handler must exist");
const handler = source.slice(start, end);

test("new payout requests fail closed before account lookup or fund reservation when PSP is not configured", () => {
  const idempotentReplay = handler.indexOf("idempotent_replay:true,payout:existing");
  const guard = handler.indexOf("if (!paymentsConfigured(env))");
  const accountLookup = handler.indexOf("SELECT * FROM payment_accounts");
  const reservation = handler.indexOf("reservePayoutAtomically(env");
  assert.ok(idempotentReplay >= 0, "same-owner idempotent replay remains supported");
  assert.ok(guard > idempotentReplay, "guard follows safe idempotent replay");
  assert.ok(accountLookup > guard, "guard precedes payment account lookup");
  assert.ok(reservation > guard, "guard precedes any payout reservation");
  assert.match(handler.slice(guard, accountLookup), /PAYOUT_PROVIDER_NOT_CONFIGURED/);
  assert.match(handler.slice(guard, accountLookup), /write_enabled:false/);
  assert.match(handler.slice(guard, accountLookup), /},503\)/);
});

test("the fail-closed payout guard does not depend on client-supplied provider or payout state", () => {
  const guard = handler.indexOf("if (!paymentsConfigured(env))");
  const accountLookup = handler.indexOf("SELECT * FROM payment_accounts");
  const guarded = handler.slice(guard, accountLookup);
  assert.doesNotMatch(guarded, /body\?\.provider|body\?\.payouts_enabled|payload/);
});
