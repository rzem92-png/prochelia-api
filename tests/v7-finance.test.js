import test from 'node:test';
import assert from 'node:assert/strict';
import { procheliaV7 } from '../src/v7.js';

test('finance legacy inputs reconcile to the cent', () => {
  const result = procheliaV7.calculateFinance({
    clientAmount: 100,
    commissionRate: 20,
    paymentFees: 2.5,
    otherFees: 1
  });
  assert.equal(result.ok, true);
  assert.equal(result.clientAmountCents, 10000);
  assert.equal(result.commissionAmountCents, 2000);
  assert.equal(result.intervenantAmountCents, 8000);
  assert.equal(result.platformNetMarginCents, 1650);
  assert.equal(result.accounting.reconciled, true);
});

test('finance supports fixed plus variable commission and PSP fee components', () => {
  const result = procheliaV7.calculateFinance({
    clientAmountCents: 12500,
    commissionFixedCents: 150,
    commissionVariableRate: 12,
    paymentFeeFixedCents: 25,
    paymentFeeRate: 1.5,
    otherFees: 0.5
  });
  assert.equal(result.ok, true);
  assert.equal(result.commissionAmountCents, 1650);
  assert.equal(result.intervenantAmountCents, 10850);
  assert.equal(result.paymentFeesCents, 213);
  assert.equal(result.platformNetMarginCents, 1387);
  assert.equal(result.accounting.reconciled, true);
});

test('finance rejects commission greater than the client amount', () => {
  const result = procheliaV7.calculateFinance({
    clientAmount: 10,
    commissionFixed: 10.01
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'COMMISSION_EXCEEDS_CLIENT_AMOUNT');
});

test('finance rejects negative fees instead of silently converting them to zero', () => {
  const result = procheliaV7.calculateFinance({
    clientAmount: 10,
    paymentFees: -1
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'PAYMENT_FEES_INVALID');
});

test('finance never accepts non-finite rates', () => {
  const result = procheliaV7.calculateFinance({
    clientAmount: 10,
    commissionRate: 'NaN'
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'COMMISSION_RATE_INVALID');
});
