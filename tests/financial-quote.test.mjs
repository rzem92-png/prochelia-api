import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinancialQuote } from '../src/financial-quote.js';

const base = { basePriceCents: 10000, commissionRate: 0.2, intervenantFloorCents: 7000,
  travelClientCents: 500, travelProviderCostCents: 500, pspPercent: 2,
  pspFixedCents: 30, softwareCostCents: 0, targetMarginPercent: 12 };

test('calculates commission, provider payout and travel separately in integer cents', () => {
  const q = calculateFinancialQuote(base);
  assert.equal(q.service_price_cents, 10000);
  assert.equal(q.commission_cents, 2000);
  assert.equal(q.intervenant_amount_cents, 8000);
  assert.equal(q.client_price_cents, 10500);
  assert.equal(q.travel_client_cents, 500);
  assert.equal(q.travel_provider_cost_cents, 500);
  assert.equal(q.psp_cost_cents, 240);
  assert.equal(q.estimated_margin_cents, 1760);
  assert.equal(q.profitability_gate, 'ALLOW');
});

test('blocks quote below provider minimum instead of silently changing price', () => {
  const q = calculateFinancialQuote({...base, intervenantFloorCents: 8500});
  assert.equal(q.provider_floor_ok, false);
  assert.equal(q.profitability_gate, 'BLOCK');
  assert.equal(q.intervenant_amount_cents, 8000);
});

test('blocks quote below contribution margin threshold', () => {
  const q = calculateFinancialQuote({...base, pspPercent: 20, targetMarginPercent: 20});
  assert.equal(q.margin_ok, false);
  assert.equal(q.profitability_status, 'MARGIN_BLOCKED');
});

test('rejects invalid fractional or unsafe money values', () => {
  assert.throws(() => calculateFinancialQuote({...base, basePriceCents: 100.5}), /INVALID_BASE_PRICE_CENTS/);
  assert.throws(() => calculateFinancialQuote({...base, pspFixedCents: -1}), /INVALID_PSP_FIXED_CENTS/);
  assert.throws(() => calculateFinancialQuote({...base, commissionRate: 1.2}), /INVALID_COMMISSION_RATE/);
});

test('rejects regulated ceiling violations; does not silently cap or uplift', () => {
  assert.throws(() => calculateFinancialQuote({...base, regulatedMaxCents: 9000}), /REGULATED_CEILING_EXCEEDED/);
});

test('applies authorized discount as a distinct input and rejects zero result', () => {
  const q = calculateFinancialQuote({...base, discountCents: 1000});
  assert.equal(q.service_price_cents, 9000);
  assert.equal(q.commission_cents, 1800);
  assert.throws(() => calculateFinancialQuote({...base, discountCents: 10000}), /SERVICE_PRICE_NOT_POSITIVE/);
});

test('rounds commission and PSP deterministically to whole cents', () => {
  const q = calculateFinancialQuote({...base, basePriceCents: 101, commissionRate: 0.155, pspPercent: 1.5, pspFixedCents: 1, intervenantFloorCents: 0, targetMarginPercent: 0});
  assert.equal(q.commission_cents, 16);
  assert.equal(q.psp_cost_cents, 3);
});
