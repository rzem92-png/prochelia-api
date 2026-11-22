import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

function handler(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} handler must exist`);
  const end = source.indexOf("\nasync function ", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

test("PSP onboarding refuses before D1 schema setup or placeholder account and wallet writes", () => {
  const body = handler("paymentOnboard");
  const guard = body.indexOf("if (!paymentsConfigured(env))");
  assert.ok(guard >= 0);
  for (const operation of ["resolveTenantContext(", "ensurePaymentSchema(env)", "INSERT INTO payment_accounts", "INSERT INTO wallets"]) {
    const position = body.indexOf(operation);
    assert.ok(position < 0 || position > guard, `${operation} must not precede the PSP capability guard`);
  }
  assert.match(body.slice(guard), /PAYMENT_PROVIDER_NOT_CONFIGURED/);
  assert.match(body.slice(guard), /write_enabled:false/);
});

test("mission payment creation refuses before D1 schema setup or pending transaction writes", () => {
  const body = handler("createMissionPayment");
  const guard = body.indexOf("if (!paymentsConfigured(env))");
  assert.ok(guard >= 0);
  for (const operation of ["ensurePaymentSchema(env)", "INSERT INTO payment_transactions", "paymentAudit(env"]) {
    const position = body.indexOf(operation);
    assert.ok(position < 0 || position > guard, `${operation} must not precede the PSP capability guard`);
  }
  assert.match(body.slice(guard), /PAYMENT_PROVIDER_NOT_CONFIGURED/);
  assert.match(body.slice(guard), /write_enabled:false/);
});

test("payout requests refuse before D1 schema setup, account lookup, or balance reservation", () => {
  const body = handler("payoutRequest");
  const guard = body.indexOf("if (!paymentsConfigured(env))");
  assert.ok(guard >= 0);
  for (const operation of ["ensurePaymentSchema(env)", "SELECT * FROM payment_accounts", "SELECT * FROM wallets", "reservePayoutAtomically(env"]) {
    const position = body.indexOf(operation);
    assert.ok(position < 0 || position > guard, `${operation} must not precede the PSP capability guard`);
  }
});

test("payment status is a read-only response and never initializes or creates wallet state", () => {
  const body = handler("paymentStatus");
  assert.match(body, /read_only:true/);
  assert.match(body, /payments_configured:false/);
  assert.match(body, /wallet:null/);
  assert.doesNotMatch(body, /ensurePaymentSchema|INSERT INTO|UPDATE wallets|DELETE FROM/);
});
