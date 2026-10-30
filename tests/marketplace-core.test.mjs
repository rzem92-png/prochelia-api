import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMarketplaceEconomics,
  canTransitionOrder,
  assertOrderTransition,
  getOrderStatuses
} from '../src/marketplace-core.js';

test('marketplace economics reconcile customer payment, provider payout, platform fee and tax', () => {
  const result = calculateMarketplaceEconomics({
    customerPaidCents: 12000,
    providerPayoutCents: 9000,
    platformFeeCents: 2400,
    taxCollectedCents: 600,
    pspFeeCents: 300,
    platformFundedDiscountCents: 200,
    variableCostCents: 100
  });
  assert.equal(result.balanced, true);
  assert.equal(result.reconciliationDeltaCents, 0);
  assert.equal(result.platformContributionCents, 1800);
  assert.equal(result.contributionPositive, true);
});

test('marketplace economics exposes reconciliation differences instead of hiding them', () => {
  const result = calculateMarketplaceEconomics({
    customerPaidCents: 10000,
    providerPayoutCents: 8000,
    platformFeeCents: 1500,
    taxCollectedCents: 300
  });
  assert.equal(result.balanced, false);
  assert.equal(result.reconciliationDeltaCents, 200);
});

test('marketplace economics rejects floats, negatives and unsafe integers', () => {
  assert.throws(() => calculateMarketplaceEconomics({
    customerPaidCents: 10.5, providerPayoutCents: 5, platformFeeCents: 5
  }), /CUSTOMER_PAID_CENTS_MUST_BE_NON_NEGATIVE_SAFE_INTEGER/);
  assert.throws(() => calculateMarketplaceEconomics({
    customerPaidCents: 100, providerPayoutCents: -1, platformFeeCents: 101
  }), /PROVIDER_PAYOUT_CENTS_MUST_BE_NON_NEGATIVE_SAFE_INTEGER/);
  assert.throws(() => calculateMarketplaceEconomics({
    customerPaidCents: Number.MAX_SAFE_INTEGER + 1, providerPayoutCents: 0, platformFeeCents: 0
  }), /CUSTOMER_PAID_CENTS_MUST_BE_NON_NEGATIVE_SAFE_INTEGER/);
});


test('marketplace economics rejects platform contribution overflow instead of returning an imprecise margin', () => {
  assert.throws(() => calculateMarketplaceEconomics({
    customerPaidCents: 100,
    providerPayoutCents: 0,
    platformFeeCents: 1,
    pspFeeCents: Number.MAX_SAFE_INTEGER,
    platformFundedDiscountCents: Number.MAX_SAFE_INTEGER,
    variableCostCents: Number.MAX_SAFE_INTEGER
  }), /PLATFORM_CONTRIBUTION_OVERFLOW/);
});

test('order state machine allows the normal paid fulfilment path', () => {
  assert.deepEqual(canTransitionOrder('DRAFT', 'QUOTED'), { ok: true, from: 'DRAFT', to: 'QUOTED' });
  assert.equal(assertOrderTransition('QUOTED', 'AWAITING_PAYMENT').to, 'AWAITING_PAYMENT');
  assert.equal(assertOrderTransition('AWAITING_PAYMENT', 'PAID').to, 'PAID');
  assert.equal(assertOrderTransition('PAID', 'ACCEPTED').to, 'ACCEPTED');
  assert.equal(assertOrderTransition('ACCEPTED', 'IN_PROGRESS').to, 'IN_PROGRESS');
  assert.equal(assertOrderTransition('IN_PROGRESS', 'FULFILLED').to, 'FULFILLED');
});

test('order state machine blocks unpaid fulfilment and terminal-state resurrection', () => {
  assert.deepEqual(canTransitionOrder('AWAITING_PAYMENT', 'IN_PROGRESS'), {
    ok: false, error: 'ORDER_TRANSITION_NOT_ALLOWED'
  });
  assert.deepEqual(canTransitionOrder('REFUNDED', 'PAID'), {
    ok: false, error: 'ORDER_TRANSITION_NOT_ALLOWED'
  });
  assert.deepEqual(canTransitionOrder('UNKNOWN', 'PAID'), {
    ok: false, error: 'UNKNOWN_ORDER_STATUS'
  });
  assert.throws(() => assertOrderTransition('CANCELLED', 'ACCEPTED'), /ORDER_TRANSITION_NOT_ALLOWED/);
});

test('order state machine includes partial refunds and disputes as explicit states', () => {
  const statuses = getOrderStatuses();
  assert.ok(statuses.includes('PARTIALLY_REFUNDED'));
  assert.ok(statuses.includes('DISPUTED'));
  assert.equal(canTransitionOrder('REFUND_PENDING', 'PARTIALLY_REFUNDED').ok, true);
  assert.equal(canTransitionOrder('PARTIALLY_REFUNDED', 'REFUNDED').ok, false);
});
