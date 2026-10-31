// Pure, deterministic financial calculation. All money inputs/outputs are integer cents.
export function calculateFinancialQuote({
  basePriceCents, phaseFactor = 1, commissionRate = 0.20,
  discountCents = 0, regulatedMaxCents = null, intervenantFloorCents = 0,
  travelClientCents = 0, travelProviderCostCents = 0,
  pspPercent = 0, pspFixedCents = 0, softwareCostCents = 0,
  targetMarginPercent = 12
} = {}) {
  const integer = (v, name, {min = 0, max = Number.MAX_SAFE_INTEGER} = {}) => {
    if (!Number.isSafeInteger(v) || v < min || v > max) throw new Error('INVALID_' + name.toUpperCase());
    return v;
  };
  const finite = (v, name, {min = 0, max = Number.MAX_SAFE_INTEGER} = {}) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error('INVALID_' + name.toUpperCase());
    return v;
  };
  integer(basePriceCents, 'base_price_cents', {min: 1});
  integer(discountCents, 'discount_cents');
  integer(intervenantFloorCents, 'intervenant_floor_cents');
  integer(travelClientCents, 'travel_client_cents');
  integer(travelProviderCostCents, 'travel_provider_cost_cents');
  integer(pspFixedCents, 'psp_fixed_cents');
  integer(softwareCostCents, 'software_cost_cents');
  if (regulatedMaxCents !== null) integer(regulatedMaxCents, 'regulated_max_cents', {min: 1});
  finite(phaseFactor, 'phase_factor', {min: 0.01, max: 10});
  finite(commissionRate, 'commission_rate', {min: 0, max: 1});
  finite(pspPercent, 'psp_percent', {min: 0, max: 20});
  finite(targetMarginPercent, 'target_margin_percent', {min: 0, max: 100});

  const baseAfterPhase = Math.round(basePriceCents * phaseFactor);
  const servicePrice = Math.max(0, baseAfterPhase - discountCents);
  if (servicePrice <= 0) throw new Error('SERVICE_PRICE_NOT_POSITIVE');
  if (regulatedMaxCents !== null && servicePrice > regulatedMaxCents) throw new Error('REGULATED_CEILING_EXCEEDED');

  const commission = Math.round(servicePrice * commissionRate);
  const providerPayout = servicePrice - commission;
  const clientTotal = servicePrice + travelClientCents;
  const psp = Math.round(clientTotal * pspPercent / 100) + pspFixedCents;
  const contribution = commission + travelClientCents - travelProviderCostCents - psp - softwareCostCents;
  const minimumMargin = Math.max(200, Math.round(clientTotal * targetMarginPercent / 100));
  const floorOk = providerPayout >= intervenantFloorCents;
  const marginOk = contribution >= minimumMargin;
  const allowed = floorOk && marginOk;

  return {
    service_price_cents: servicePrice,
    client_price_cents: clientTotal,
    intervenant_amount_cents: providerPayout,
    commission_cents: commission,
    travel_client_cents: travelClientCents,
    travel_provider_cost_cents: travelProviderCostCents,
    psp_cost_cents: psp,
    software_cost_cents: softwareCostCents,
    estimated_margin_cents: contribution,
    minimum_margin_cents: minimumMargin,
    provider_floor_ok: floorOk,
    margin_ok: marginOk,
    profitability_status: !floorOk ? 'PROVIDER_FLOOR_BLOCKED' : !marginOk ? 'MARGIN_BLOCKED' : 'RENTABLE',
    profitability_gate: allowed ? 'ALLOW' : 'BLOCK'
  };
}
