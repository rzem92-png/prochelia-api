// Pure, deterministic financial model. No I/O, database access, or side effects.
const isSafeCents = value => Number.isSafeInteger(value) && value >= 0;
const roundRatio = (amount, numerator, denominator) =>
  Number((BigInt(amount) * BigInt(numerator) + BigInt(Math.floor(denominator / 2))) / BigInt(denominator));

export function calculateB2CQuote(input = {}) {
  const {
    serviceGrossCents,
    commissionRateBps,
    providerMinimumCents = 0,
    travelClientCents = 0,
    travelProviderCostCents = 0,
    pspRateBps = 0,
    pspFixedCents = 0,
    otherVariableCostsCents = 0,
    minimumContributionCents = 0,
    targetContributionRateBps = 0,
    regulatedClientCeilingCents = null
  } = input;

  const cents = {
    serviceGrossCents, providerMinimumCents, travelClientCents,
    travelProviderCostCents, pspFixedCents, otherVariableCostsCents,
    minimumContributionCents
  };
  for (const [key, value] of Object.entries(cents)) {
    if (!isSafeCents(value)) return { ok: false, error: 'INVALID_' + key.replace(/[A-Z]/g, c => '_' + c).toUpperCase() };
  }
  for (const [key, value] of Object.entries({ commissionRateBps, pspRateBps, targetContributionRateBps })) {
    if (!Number.isInteger(value) || value < 0 || value > 10000) {
      return { ok: false, error: 'INVALID_' + key.replace(/[A-Z]/g, c => '_' + c).toUpperCase() };
    }
  }
  if (regulatedClientCeilingCents !== null && !isSafeCents(regulatedClientCeilingCents)) {
    return { ok: false, error: 'INVALID_REGULATED_CLIENT_CEILING_CENTS' };
  }

  const commissionCents = roundRatio(serviceGrossCents, commissionRateBps, 10000);
  const providerPayoutCents = serviceGrossCents - commissionCents;
  const clientTotalCents = serviceGrossCents + travelClientCents;
  if (!Number.isSafeInteger(clientTotalCents)) return { ok: false, error: 'AMOUNT_OVERFLOW' };

  const pspFeeCents = roundRatio(clientTotalCents, pspRateBps, 10000) + pspFixedCents;
  const platformContributionCents =
    commissionCents + travelClientCents - travelProviderCostCents -
    pspFeeCents - otherVariableCostsCents;
  const targetContributionCents = Math.max(
    minimumContributionCents,
    roundRatio(clientTotalCents, targetContributionRateBps, 10000)
  );

  const blockers = [];
  if (providerPayoutCents < providerMinimumCents) blockers.push('PROVIDER_MINIMUM_NOT_MET');
  if (regulatedClientCeilingCents !== null && clientTotalCents > regulatedClientCeilingCents) {
    blockers.push('REGULATED_CLIENT_CEILING_EXCEEDED');
  }
  if (platformContributionCents < targetContributionCents) blockers.push('MINIMUM_PLATFORM_CONTRIBUTION_NOT_MET');

  return {
    ok: blockers.length === 0,
    status: blockers.length === 0 ? 'ALLOW' : 'BLOCK',
    blockers,
    currency: 'EUR',
    service_gross_cents: serviceGrossCents,
    commission_rate_bps: commissionRateBps,
    commission_cents: commissionCents,
    provider_payout_cents: providerPayoutCents,
    provider_minimum_cents: providerMinimumCents,
    travel_client_cents: travelClientCents,
    travel_provider_cost_cents: travelProviderCostCents,
    client_total_cents: clientTotalCents,
    psp_fee_cents: pspFeeCents,
    other_variable_costs_cents: otherVariableCostsCents,
    platform_contribution_cents: platformContributionCents,
    target_contribution_cents: targetContributionCents,
    regulated_client_ceiling_cents: regulatedClientCeilingCents
  };
}
