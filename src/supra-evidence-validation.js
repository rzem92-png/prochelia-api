// SUPRA evidence-first validation helpers.
// These deterministic functions do not fetch market data or certify legal compliance.
// Trusted adapters must collect, timestamp, source, permission-check and validate evidence.
const ALLOWED_EVIDENCE_CLASSES = new Set([
  "customer_interview", "customer_survey", "pilot_event", "transaction",
  "payment_provider_report", "accounting_record", "cost_invoice",
  "retention_cohort", "support_ticket", "legal_review", "regulatory_source",
  "security_audit", "consent_record", "market_source"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function validDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function validateEvidenceRecord(record, now = new Date().toISOString()) {
  if (!isPlainObject(record)) return { valid: false, reason: "RECORD_REQUIRED" };
  const required = ["id", "class", "source", "collectedAt", "owner", "permission"];
  if (required.some(key => typeof record[key] !== "string" || !record[key].trim())) {
    return { valid: false, reason: "REQUIRED_METADATA_MISSING" };
  }
  if (!ALLOWED_EVIDENCE_CLASSES.has(record.class)) return { valid: false, reason: "EVIDENCE_CLASS_UNKNOWN" };
  if (!validDate(record.collectedAt) || Date.parse(record.collectedAt) > Date.parse(now)) {
    return { valid: false, reason: "INVALID_EVIDENCE_TIMESTAMP" };
  }
  if (!["public", "consented", "contractual", "internal_authorized"].includes(record.permission)) {
    return { valid: false, reason: "EVIDENCE_PERMISSION_INVALID" };
  }
  if (record.permission === "consented" && record.consentReference == null) {
    return { valid: false, reason: "CONSENT_REFERENCE_REQUIRED" };
  }
  if (record.personalData === true && record.dataMinimized !== true) {
    return { valid: false, reason: "PERSONAL_DATA_MINIMIZATION_REQUIRED" };
  }
  if (typeof record.claim !== "string" || !record.claim.trim()) return { valid: false, reason: "CLAIM_REQUIRED" };
  if (!["observed", "reported", "estimated", "forecast"].includes(record.evidenceKind)) {
    return { valid: false, reason: "EVIDENCE_KIND_REQUIRED" };
  }
  return { valid: true, reason: "EVIDENCE_METADATA_VALID" };
}

export function assessEvidenceSet(records, options = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    return { status: "INSUFFICIENT", verifiedCount: 0, rejectedCount: 0, reasons: ["NO_EVIDENCE"] };
  }
  const now = options.now ?? new Date().toISOString();
  const maxAgeDays = Number.isFinite(options.maxAgeDays) ? options.maxAgeDays : 180;
  const validated = records.map(record => ({ record, result: validateEvidenceRecord(record, now) }));
  const verified = validated.filter(({ record, result }) => result.valid &&
    (Date.parse(now) - Date.parse(record.collectedAt)) <= maxAgeDays * 86400000);
  const stale = validated.filter(({ record, result }) => result.valid &&
    (Date.parse(now) - Date.parse(record.collectedAt)) > maxAgeDays * 86400000);
  const rejected = validated.filter(({ result }) => !result.valid);
  const reasons = rejected.map(({ result }) => result.reason);
  if (stale.length) reasons.push("STALE_EVIDENCE");
  const required = Number.isInteger(options.minimumEvidence) && options.minimumEvidence > 0 ? options.minimumEvidence : 3;
  return {
    status: verified.length >= required && rejected.length === 0 && stale.length === 0 ? "SUPPORTED" : "INSUFFICIENT",
    verifiedCount: verified.length,
    rejectedCount: rejected.length,
    staleCount: stale.length,
    reasons: [...new Set(reasons)],
    caveat: "Evidence metadata checks do not establish truth, representativeness, legal compliance or causality."
  };
}

export function calculateUnitEconomics(input) {
  if (!isPlainObject(input)) return { ok: false, reason: "INPUT_REQUIRED" };
  const fields = ["grossPlatformRevenue", "paymentFees", "supportCost", "aiCost", "riskReserve", "acquisitionCost", "otherVariableCosts"];
  for (const field of fields) {
    if (!Number.isFinite(input[field]) || input[field] < 0) return { ok: false, reason: "INVALID_COST_OR_REVENUE", field };
  }
  const contribution = input.grossPlatformRevenue - fields.slice(1).reduce((sum, field) => sum + input[field], 0);
  const denominator = input.averageContributionPerTransaction;
  const fixedCosts = input.monthlyFixedCosts;
  if (denominator !== undefined && (!Number.isFinite(denominator) || denominator <= 0)) {
    return { ok: false, reason: "POSITIVE_CONTRIBUTION_REQUIRED_FOR_BREAK_EVEN" };
  }
  if (fixedCosts !== undefined && (!Number.isFinite(fixedCosts) || fixedCosts < 0)) {
    return { ok: false, reason: "INVALID_FIXED_COSTS" };
  }
  return {
    ok: true,
    contribution,
    contributionMarginRate: input.grossPlatformRevenue > 0 ? contribution / input.grossPlatformRevenue : null,
    breakEvenTransactions: fixedCosts !== undefined && denominator > 0 ? Math.ceil(fixedCosts / denominator) : null,
    profitableTransaction: contribution > 0,
    assumptionsRequired: ["currency", "period", "taxBasis", "sourceReferences", "measurementWindow"]
  };
}

export function evaluateValidationGates(input = {}) {
  const gates = [
    "marketDemandEvidence", "unitEconomicsEvidence", "costEvidence",
    "complianceReview", "retentionEvidence", "securityPrivacyReview",
    "humanOwnerApproval"
  ];
  const missing = gates.filter(key => input[key] !== true);
  return {
    status: missing.length === 0 ? "READY_FOR_HUMAN_REVIEW" : "NO_GO",
    missing,
    productionAuthorized: false,
    reason: "This evaluator cannot authorize production, payments or legal compliance."
  };
}
