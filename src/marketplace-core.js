// PROCHÉLIA LIFE — deterministic marketplace domain primitives.
// Pure functions only: no database writes, PSP calls, or implicit money movement.
// All monetary values are integer minor units (for example, euro cents).

const ORDER_TRANSITIONS = Object.freeze({
  DRAFT: new Set(['QUOTED', 'CANCELLED']),
  QUOTED: new Set(['AWAITING_PAYMENT', 'CANCELLED']),
  AWAITING_PAYMENT: new Set(['PAID', 'CANCELLED']),
  PAID: new Set(['ACCEPTED', 'REFUND_PENDING', 'DISPUTED']),
  ACCEPTED: new Set(['IN_PROGRESS', 'CANCELLED', 'REFUND_PENDING', 'DISPUTED']),
  IN_PROGRESS: new Set(['FULFILLED', 'DISPUTED']),
  FULFILLED: new Set(['REFUND_PENDING', 'DISPUTED']),
  REFUND_PENDING: new Set(['PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED']),
  PARTIALLY_REFUNDED: new Set(['REFUND_PENDING', 'DISPUTED']),
  DISPUTED: new Set(['REFUND_PENDING', 'FULFILLED', 'CANCELLED']),
  CANCELLED: new Set(),
  REFUNDED: new Set()
});

function cents(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(field + '_MUST_BE_NON_NEGATIVE_SAFE_INTEGER');
  }
  return value;
}

export function calculateMarketplaceEconomics(input = {}) {
  const customerPaidCents = cents(input.customerPaidCents, 'CUSTOMER_PAID_CENTS');
  const providerPayoutCents = cents(input.providerPayoutCents, 'PROVIDER_PAYOUT_CENTS');
  const platformFeeCents = cents(input.platformFeeCents, 'PLATFORM_FEE_CENTS');
  const taxCollectedCents = cents(input.taxCollectedCents ?? 0, 'TAX_COLLECTED_CENTS');
  const pspFeeCents = cents(input.pspFeeCents ?? 0, 'PSP_FEE_CENTS');
  const platformFundedDiscountCents = cents(input.platformFundedDiscountCents ?? 0, 'PLATFORM_FUNDED_DISCOUNT_CENTS');
  const variableCostCents = cents(input.variableCostCents ?? 0, 'VARIABLE_COST_CENTS');

  const allocatedCents = providerPayoutCents + platformFeeCents + taxCollectedCents;
  if (!Number.isSafeInteger(allocatedCents)) throw new RangeError('ALLOCATION_OVERFLOW');
  const reconciliationDeltaCents = customerPaidCents - allocatedCents;
  const platformContributionCents = platformFeeCents
    - pspFeeCents
    - platformFundedDiscountCents
    - variableCostCents;
  if (!Number.isSafeInteger(platformContributionCents)) {
    throw new RangeError('PLATFORM_CONTRIBUTION_OVERFLOW');
  }

  return Object.freeze({
    currency: String(input.currency || 'EUR').toUpperCase(),
    customerPaidCents,
    providerPayoutCents,
    platformFeeCents,
    taxCollectedCents,
    pspFeeCents,
    platformFundedDiscountCents,
    variableCostCents,
    allocatedCents,
    reconciliationDeltaCents,
    balanced: reconciliationDeltaCents === 0,
    platformContributionCents,
    contributionPositive: platformContributionCents > 0
  });
}

export function canTransitionOrder(currentStatus, nextStatus) {
  const current = String(currentStatus || '').trim().toUpperCase();
  const next = String(nextStatus || '').trim().toUpperCase();
  if (!ORDER_TRANSITIONS[current] || !ORDER_TRANSITIONS[next]) {
    return { ok: false, error: 'UNKNOWN_ORDER_STATUS' };
  }
  if (!ORDER_TRANSITIONS[current].has(next)) {
    return { ok: false, error: 'ORDER_TRANSITION_NOT_ALLOWED' };
  }
  return { ok: true, from: current, to: next };
}

export function assertOrderTransition(currentStatus, nextStatus) {
  const result = canTransitionOrder(currentStatus, nextStatus);
  if (!result.ok) throw new Error(result.error);
  return result;
}

export function getOrderStatuses() {
  return Object.freeze(Object.keys(ORDER_TRANSITIONS));
}
