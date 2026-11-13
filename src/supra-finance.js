// PROCHÉLIA — SUPRA Finance Core V1
// Deterministic, side-effect-free quote arithmetic.
// All monetary values are integer minor units (e.g. cents); never use floats.
// This module does not create charges, payouts, invoices or ledger entries.

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function assertMinor(name, value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(name + "_MUST_BE_NON_NEGATIVE_SAFE_INTEGER");
  }
  return BigInt(value);
}

function roundHalfUp(numerator, denominator) {
  if (denominator <= 0n) throw new RangeError("INVALID_DENOMINATOR");
  return (numerator + denominator / 2n) / denominator;
}

function toSafeNumber(name, value) {
  if (value > MAX_SAFE || value < -MAX_SAFE) {
    throw new RangeError(name + "_OUT_OF_SAFE_RANGE");
  }
  return Number(value);
}

/**
 * Calculate a quote preview using integer minor units and commission basis points.
 * commissionBps: 1500 means 15.00%. No rate is prescribed by this module.
 */
export function calculateSupraQuote({
  grossAmountMinor,
  commissionBps,
  paymentFeeMinor = 0,
  operatingCostMinor = 0,
  currency
} = {}) {
  const gross = assertMinor("grossAmountMinor", grossAmountMinor);
  const paymentFees = assertMinor("paymentFeeMinor", paymentFeeMinor);
  const operatingCosts = assertMinor("operatingCostMinor", operatingCostMinor);

  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000) {
    throw new TypeError("commissionBps_MUST_BE_INTEGER_BETWEEN_0_AND_10000");
  }
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
    throw new TypeError("currency_MUST_BE_ISO_4217_CODE");
  }

  const commission = roundHalfUp(gross * BigInt(commissionBps), 10000n);
  if (commission > gross) throw new RangeError("COMMISSION_EXCEEDS_GROSS_AMOUNT");

  const providerNet = gross - commission;
  const platformContribution = commission - paymentFees - operatingCosts;

  const snapshot = {
    calculationVersion: "SUPRA_FINANCE_V1",
    currency,
    grossAmountMinor: toSafeNumber("grossAmountMinor", gross),
    commissionBps,
    commissionAmountMinor: toSafeNumber("commissionAmountMinor", commission),
    providerNetAmountMinor: toSafeNumber("providerNetAmountMinor", providerNet),
    paymentFeeMinor: toSafeNumber("paymentFeeMinor", paymentFees),
    operatingCostMinor: toSafeNumber("operatingCostMinor", operatingCosts),
    platformContributionMinor: toSafeNumber("platformContributionMinor", platformContribution),
    contributionPositive: platformContribution > 0n,
    contributionBreakEven: platformContribution === 0n,
    contributionNegative: platformContribution < 0n,
    moneyUnit: "MINOR",
    isQuotePreview: true,
    createsFinancialObligation: false
  };

  return Object.freeze(snapshot);
}
