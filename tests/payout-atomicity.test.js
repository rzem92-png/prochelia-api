import test from "node:test";
import assert from "node:assert/strict";
import { reservePayoutAtomically, samePayoutRequest } from "../src/index.js";

function fakeDb(results) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return { bind(...values) { return { sql, values }; } };
    },
    async batch(statements) {
      calls.push(...statements);
      return results;
    }
  };
}

test("payout reservation batches insert, conditional debit and audit atomically", async () => {
  const DB = fakeDb([{meta:{changes:1}},{meta:{changes:1}},{meta:{changes:1}}]);
  const result = await reservePayoutAtomically({DB}, {
    payoutId:"payout-1",idempotencyKey:"idem-1",walletId:"wallet-1",userId:"user-1",tenantId:"tenant-1",
    amountCents:2500,mode:"standard",provider:"psp_adapter"
  });
  assert.deepEqual(result,{ok:true,reason:null});
  assert.equal(DB.calls.length,3);
  assert.match(DB.calls[0].sql,/tenant_id/);
  assert.match(DB.calls[0].sql,/NOT EXISTS \(SELECT 1 FROM payout_requests WHERE idempotency_key=\? AND tenant_id=\?\)/);
  assert.match(DB.calls[0].sql,/currency='EUR'/);
  assert.match(DB.calls[1].sql,/currency='EUR'/);
  assert.match(DB.calls[1].sql,/available_cents>=\?/);
  assert.match(DB.calls[1].sql,/tenant_id/);
  assert.match(DB.calls[1].sql,/EXISTS \(SELECT 1 FROM payout_requests/);
  assert.match(DB.calls[2].sql,/INSERT INTO payment_audit/);
});


test("payout idempotency is bound to the same user, tenant, EUR wallet, amount and mode", () => {
  const existing = {
    user_id: "user-1",
    tenant_id: "tenant-1",
    wallet_id: "wallet-eur-1",
    amount_cents: 2500,
    mode: "standard",
    currency: "EUR"
  };
  const requested = {
    userId: "user-1",
    tenantId: "tenant-1",
    walletId: "wallet-eur-1",
    amountCents: 2500,
    mode: "standard",
    currency: "EUR"
  };
  assert.equal(samePayoutRequest(existing, requested), true);
  for (const [key, value] of Object.entries({
    userId: "user-2",
    tenantId: "tenant-2",
    walletId: "wallet-usd-1",
    amountCents: 3000,
    mode: "express",
    currency: "USD"
  })) {
    assert.equal(samePayoutRequest(existing, { ...requested, [key]: value }), false, key);
  }
  assert.equal(samePayoutRequest({ ...existing, currency: "USD" }, requested), false, "stored currency");
});

test("payout reservation fails closed when conditional insert or debit changes no row", async () => {
  const DB = fakeDb([{meta:{changes:0}},{meta:{changes:0}},{meta:{changes:0}}]);
  const result = await reservePayoutAtomically({DB}, {
    payoutId:"payout-2",idempotencyKey:"idem-2",walletId:"wallet-2",userId:"user-2",tenantId:"tenant-2",
    amountCents:1000,mode:"express",provider:"psp_adapter"
  });
  assert.deepEqual(result,{ok:false,reason:"NOT_RESERVED"});
});

test("invalid payout input never reaches the database", async () => {
  const DB = fakeDb([]);
  const result = await reservePayoutAtomically({DB}, {
    payoutId:"payout-3",idempotencyKey:"idem-3",walletId:"wallet-3",userId:"user-3",tenantId:"tenant-3",
    amountCents:0,mode:"standard",provider:"psp_adapter"
  });
  assert.deepEqual(result,{ok:false,reason:"INVALID_INPUT"});
  assert.equal(DB.calls.length,0);
});
