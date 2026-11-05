// SUPRA decision ranking — deterministic proposal ordering, no external side effects.
const HIGH_RISK = new Set(["financial", "payment", "refund", "payout", "legal", "contract", "security", "privacy", "production", "migration", "deletion", "human_impact"]);
const AUTONOMY = Object.freeze({ A0: "observe", A1: "prepare", A2: "preauthorized_reversible", A3: "manager_approval", A4: "mandatory_human" });

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function bounded(value, max = 500) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}
function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

export function classifySupraAutonomy(input = {}) {
  if (!plain(input)) return { level: "A4", action: AUTONOMY.A4, reason: "INVALID_INPUT_FAIL_CLOSED" };
  const risk = Array.isArray(input.riskTypes) ? input.riskTypes : [];
  if (risk.some(item => typeof item !== "string" || HIGH_RISK.has(item.toLowerCase())) ||
      input.irreversible === true || input.externalCommitment === true || input.productionImpact === true) {
    return { level: "A4", action: AUTONOMY.A4, reason: "HIGH_IMPACT_REQUIRES_HUMAN" };
  }
  if (input.externalSideEffect === true || input.moneyMovement === true || input.personalDataChange === true) {
    return { level: "A3", action: AUTONOMY.A3, reason: "EXTERNAL_SIDE_EFFECT_REQUIRES_APPROVAL" };
  }
  if (input.preapproved === true && input.reversible === true && input.adapterVerified === true &&
      input.authorizationVerified === true && input.idempotencyVerified === true) {
    return { level: "A2", action: AUTONOMY.A2, reason: "PREAUTHORIZED_REVERSIBLE_ACTION" };
  }
  if (input.draftOnly === true) return { level: "A1", action: AUTONOMY.A1, reason: "PREPARE_ONLY" };
  return { level: "A0", action: AUTONOMY.A0, reason: "OBSERVE_ONLY_DEFAULT" };
}

export function rankSupraProposals(proposals, options = {}) {
  if (!Array.isArray(proposals) || proposals.length === 0 || proposals.length > 20) {
    return { ok: false, code: "PROPOSALS_REQUIRED_OR_LIMIT_EXCEEDED" };
  }
  const weights = plain(options.weights) ? options.weights : {};
  const defaults = { impact: 0.30, confidence: 0.25, urgency: 0.15, reversibility: 0.15, costEfficiency: 0.15 };
  const normalized = Object.fromEntries(Object.keys(defaults).map(k => [k, finiteNonNegative(weights[k]) ? weights[k] : defaults[k]]));
  const totalWeight = Object.values(normalized).reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return { ok: false, code: "INVALID_WEIGHTS" };

  const ids = new Set();
  const result = [];
  for (const p of proposals) {
    if (!plain(p) || !bounded(p.id, 100) || !bounded(p.title, 200) || !bounded(p.description, 1000) ||
        !bounded(p.risk, 40) || !bounded(p.expectedOutcome, 500) ||
        !bounded(p.evidenceReference, 200) || !bounded(p.ownerDomain, 100) ||
        !["low", "medium", "high", "critical"].includes(p.risk.toLowerCase()) ||
        ["impact", "confidence", "urgency", "reversibility", "costEfficiency"].some(k => !finiteNonNegative(p[k]) || p[k] > 100)) {
      return { ok: false, code: "INVALID_PROPOSAL" };
    }
    if (ids.has(p.id)) return { ok: false, code: "DUPLICATE_PROPOSAL_ID" };
    ids.add(p.id);
    const score = Object.keys(defaults).reduce((sum, key) => sum + p[key] * normalized[key], 0) / totalWeight;
    const autonomy = classifySupraAutonomy({
      riskTypes: p.risk.toLowerCase() === "critical" ? ["security"] : [],
      irreversible: p.irreversible === true,
      externalCommitment: p.externalCommitment === true,
      externalSideEffect: p.externalSideEffect === true,
      moneyMovement: p.moneyMovement === true,
      personalDataChange: p.personalDataChange === true,
      preapproved: p.preapproved === true,
      reversible: p.reversible === true,
      adapterVerified: p.adapterVerified === true,
      authorizationVerified: p.authorizationVerified === true,
      idempotencyVerified: p.idempotencyVerified === true,
      draftOnly: true
    });
    result.push({ ...p, score: Math.round(score * 100) / 100, autonomy, requiresManagerApproval: ["A3", "A4"].includes(autonomy.level) });
  }
  result.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { ok: true, proposals: result.map((p, index) => ({ ...p, rank: index + 1 })), weights: normalized, scoring: "weighted_sum_0_to_100" };
}

export function createSupraApprovalSummary(proposal, context = {}) {
  if (!plain(proposal) || !bounded(proposal.id, 100) || !bounded(proposal.title, 200) ||
      !bounded(proposal.expectedOutcome, 500) || !bounded(proposal.evidenceReference, 200) ||
      !plain(context) || !bounded(context.caseId, 100) || !bounded(context.generatedAt, 50)) {
    return { ok: false, code: "APPROVAL_CONTEXT_INVALID" };
  }
  return {
    ok: true,
    approval: {
      caseId: context.caseId,
      proposalId: proposal.id,
      title: proposal.title,
      expectedOutcome: proposal.expectedOutcome,
      evidenceReference: proposal.evidenceReference,
      generatedAt: context.generatedAt,
      decisionRequired: true,
      choices: ["approve", "reject", "request_more_evidence"],
      executionAllowed: false,
      warning: "This approval summary does not execute an action. Approval must be verified server-side and bound to the exact proposal/version."
    }
  };
}
