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

test('promotion activation accepts only a valid manager-approved configuration', () => {
  const result = procheliaV7.validatePromotionActivation({
    id: 'promo-1', code: 'WELCOME', name: 'Bienvenue', status: 'DRAFT',
    phase: 'TEST', client_type: 'B2C', discount_type: 'PERCENT',
    discount_value: 10, min_amount_cents: 1000, max_discount_cents: 500,
    budget_cents: 10000, used_cents: 250, target_margin_percent: 15,
    intervenant_protection_cents: 0,
    starts_at: '2026-10-30T00:00:00.000Z',
    ends_at: '2026-12-01T00:00:00.000Z'
  }, { now: new Date('2026-10-30T12:00:00.000Z'), allowedPhases: ['TEST'] });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'READY_FOR_MANAGER_ACTIVATION');
});

test('promotion activation rejects a discount above 100 percent', () => {
  const result = procheliaV7.validatePromotionActivation({
    id: 'promo-2', code: 'BAD', name: 'Bad', status: 'DRAFT',
    phase: 'TEST', client_type: 'B2C', discount_type: 'PERCENT',
    discount_value: 101, starts_at: '2026-10-30T00:00:00Z',
    ends_at: '2026-12-01T00:00:00Z'
  }, { now: new Date('2026-10-30T12:00:00Z'), allowedPhases: ['TEST'] });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'PROMOTION_DISCOUNT_INVALID');
});

test('promotion activation rejects exhausted budgets and expired dates', () => {
  const base = {
    id: 'promo-3', code: 'BUDGET', name: 'Budget', status: 'DRAFT',
    phase: 'TEST', client_type: 'ALL', discount_type: 'FIXED',
    discount_value: 200, budget_cents: 1000, used_cents: 1001,
    starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-29T00:00:00Z'
  };
  const result = procheliaV7.validatePromotionActivation(base, {
    now: new Date('2026-10-30T12:00:00Z'), allowedPhases: ['TEST']
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'PROMOTION_FINANCIAL_RULES_INVALID');
});

test('promotion activation rejects an already active promotion', () => {
  const result = procheliaV7.validatePromotionActivation({
    id: 'promo-4', status: 'ACTIVE'
  }, { now: new Date('2026-10-30T12:00:00Z'), allowedPhases: ['TEST'] });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'PROMOTION_ALREADY_ACTIVE');
});
