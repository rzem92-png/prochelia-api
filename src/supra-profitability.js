// PROCHÉLIA LIFE — profitability engine (pure calculation, no DB writes).
// Only settled/reconciled ledger facts count as realized revenue or cost.
// Forecasts and quotes must never be mixed into actuals.

const MONEY_FIELDS = [
  "clientPaidCents",
  "providerPaidCents",
  "platformCommissionCents",
  "pspFeeCents",
  "taxCents",
  "refundCents",
  "variableOperatingCostCents"
];

function validCents(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  if (typeof record.status !== "string" || !["SETTLED", "RECONCILED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(record.status)) return false;
  if (typeof record.activity !== "string" || !record.activity.trim() || record.activity.length > 80) return false;
  return MONEY_FIELDS.every(field => validCents(record[field] ?? 0));
}

export function calculateProfitability(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      !Array.isArray(input.orders) || input.orders.length > 100000) {
    return { ok: false, error: "INVALID_PROFITABILITY_INPUT" };
  }
  if (!input.orders.every(validRecord)) {
    return { ok: false, error: "INVALID_OR_UNRECONCILED_LEDGER_RECORD" };
  }

  const totals = {
    settledOrders: 0,
    refundedOrders: 0,
    clientPaidCents: 0,
    providerPaidCents: 0,
    platformCommissionCents: 0,
    pspFeeCents: 0,
    taxCents: 0,
    refundCents: 0,
    variableOperatingCostCents: 0,
    contributionMarginCents: 0
  };
  const byActivity = Object.create(null);

  for (const order of input.orders) {
    const isRefund = order.status === "REFUNDED" || order.status === "PARTIALLY_REFUNDED";
    const target = byActivity[order.activity] ||= {
      orders: 0, refundedOrders: 0, clientPaidCents: 0, providerPaidCents: 0,
      platformCommissionCents: 0, pspFeeCents: 0, taxCents: 0,
      refundCents: 0, variableOperatingCostCents: 0, contributionMarginCents: 0
    };
    if (isRefund) {
      totals.refundedOrders++;
      target.refundedOrders++;
    } else {
      totals.settledOrders++;
      target.orders++;
    }
    for (const field of MONEY_FIELDS) {
      totals[field] += order[field] ?? 0;
      target[field] += order[field] ?? 0;
    }
  }

  for (const group of Object.values(byActivity)) {
    group.contributionMarginCents =
      group.platformCommissionCents - group.pspFeeCents -
      group.variableOperatingCostCents - group.refundCents;
    totals.contributionMarginCents += group.contributionMarginCents;
  }

  // Contribution margin excludes taxes and provider payouts because the
  // platform commission is the platform's earned gross revenue in this model.
  // Fixed overhead, payroll, marketing spend and income tax need separate,
  // attributable ledger inputs before net profit can be reported.
  return {
    ok: true,
    currency: "EUR_CENTS",
    source: "SETTLED_OR_RECONCILED_LEDGER_ONLY",
    totals,
    byActivity,
    metrics: {
      contributionMarginRate: totals.platformCommissionCents > 0
        ? Number((totals.contributionMarginCents / totals.platformCommissionCents).toFixed(4))
        : null,
      netProfitAvailable: false,
      reasonNetProfitUnavailable: "FIXED_OVERHEAD_AND_FULL_COST_ALLOCATION_NOT_PROVIDED"
    },
    executionAllowed: false,
    note: "Indicateur analytique calculé à partir des écritures fournies ; ce n'est ni une clôture comptable ni une prévision."
  };
}
