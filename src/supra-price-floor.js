// PROCHÉLIA — deterministic price-floor guardrail.
// Pure calculation only: never creates a quote, booking, payment or payout.
// Amounts are integer cents; percentages are basis points (100 = 1%).
const MAX_BPS = 10000;
const MAX_CENTS = Number.MAX_SAFE_INTEGER;

const isCents = n => Number.isSafeInteger(n) && n >= 0 && n <= MAX_CENTS;
const isBps = n => Number.isSafeInteger(n) && n >= 0 && n <= MAX_BPS;

function ceilDiv(n, d) {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || n < 0 || d <= 0) return null;
  return Math.floor(n / d) + (n % d === 0 ? 0 : 1);
}

/**
 * Inputs:
 * providerPayoutCents: guaranteed payout to provider
 * variableCostCents: platform variable cost per mission
 * fixedPspFeeCents + pspRateBps: PSP fee model, rate applied to final price
 * riskReserveCents: explicit contingency buffer (not a guarantee)
 * targetContributionCents: desired platform contribution after above costs
 * maxClientPriceCents (optional): maximum customer price acceptable
 */
export function calculatePriceFloor(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "INVALID_PRICE_INPUT", executionAllowed: false };
  }
  const fields = ["providerPayoutCents", "variableCostCents", "fixedPspFeeCents",
    "riskReserveCents", "targetContributionCents"];
  if (!fields.every(k => isCents(input[k])) || !isBps(input.pspRateBps) ||
      input.pspRateBps >= MAX_BPS ||
      (input.maxClientPriceCents !== undefined && !isCents(input.maxClientPriceCents))) {
    return { ok: false, error: "INVALID_PRICE_INPUT", executionAllowed: false };
  }
  const base = input.providerPayoutCents + input.variableCostCents +
    input.fixedPspFeeCents + input.riskReserveCents + input.targetContributionCents;
  if (!Number.isSafeInteger(base)) {
    return { ok: false, error: "PRICE_OVERFLOW", executionAllowed: false };
  }
  // Price >= base + rate*price. Solve using integer arithmetic and round upward.
  const denominator = MAX_BPS - input.pspRateBps;
  const numerator = base * MAX_BPS;
  if (!Number.isSafeInteger(numerator)) {
    return { ok: false, error: "PRICE_OVERFLOW", executionAllowed: false };
  }
  const minClientPriceCents = ceilDiv(numerator, denominator);
  if (minClientPriceCents === null) {
    return { ok: false, error: "PRICE_OVERFLOW", executionAllowed: false };
  }
  // BigInt prevents unsafe intermediate multiplication from silently becoming NaN/null/0.
  const rateFeeBig = (BigInt(minClientPriceCents) * BigInt(input.pspRateBps) +
    BigInt(MAX_BPS - 1)) / BigInt(MAX_BPS);
  const pspFeeBig = BigInt(input.fixedPspFeeCents) + rateFeeBig;
  if (pspFeeBig > BigInt(MAX_CENTS)) {
    return { ok: false, error: "PRICE_OVERFLOW", executionAllowed: false };
  }
  const pspFeeCents = Number(pspFeeBig);
  const contributionCents = minClientPriceCents - input.providerPayoutCents -
    input.variableCostCents - pspFeeCents - input.riskReserveCents;
  const viable = input.maxClientPriceCents === undefined ||
    minClientPriceCents <= input.maxClientPriceCents;
  return {
    ok: true,
    currency: "EUR_CENTS",
    minClientPriceCents,
    providerPayoutCents: input.providerPayoutCents,
    estimatedPspFeeCents: pspFeeCents,
    variableCostCents: input.variableCostCents,
    riskReserveCents: input.riskReserveCents,
    targetContributionCents: input.targetContributionCents,
    estimatedContributionCents: contributionCents,
    maxClientPriceCents: input.maxClientPriceCents ?? null,
    viable,
    bookingAllowedByPriceGuard: viable && contributionCents >= input.targetContributionCents,
    executionAllowed: false,
    assumptions: ["PSP fee model is an input and must be validated against contract",
      "tax/VAT, refunds, chargebacks, fixed overhead and legal obligations are not automatically included",
      "this is a quote guardrail, not a profit or solvency guarantee"]
  };
}
