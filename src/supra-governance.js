// PROCHÉLIA — SUPRA Executive Governance V1
// Deterministic, deny-by-default action policy for the future executive orchestrator.
// This module evaluates permissions only. It does not execute tools or mutate data.

const ANALYSIS_ACTIONS = new Set([
  "READ_ANALYZE",
  "SIMULATE",
  "DRAFT_PROPOSAL"
]);

const REVERSIBLE_INTERNAL_ACTIONS = new Set([
  "INTERNAL_TASK_CREATE",
  "INTERNAL_REMINDER_CREATE",
  "INTERNAL_CASE_TAG"
]);

const HUMAN_GATED_ACTIONS = new Set([
  "EXTERNAL_MESSAGE_SEND",
  "PRICE_POLICY_CHANGE",
  "REFUND_ISSUE",
  "PAYOUT_RELEASE",
  "PAYMENT_CAPTURE",
  "TALENT_SUSPEND",
  "DATA_EXPORT",
  "DATA_ERASURE",
  "SECURITY_POLICY_CHANGE",
  "PRODUCTION_DEPLOY"
]);

const NEVER_AUTONOMOUS_ACTIONS = new Set([
  "CONTRACT_SIGN",
  "LEGAL_DECISION",
  "REGULATORY_FILING",
  "IDENTITY_DECISION"
]);

const FINANCIAL_ACTIONS = new Set([
  "REFUND_ISSUE",
  "PAYOUT_RELEASE",
  "PAYMENT_CAPTURE"
]);

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function approvedByManager(approval) {
  return approval?.approved === true &&
    approval?.approverRole === "gerante" &&
    nonEmptyString(approval?.approvalId);
}

function result(decision, reason, extra = {}) {
  return Object.freeze({
    policyVersion: "SUPRA_EXECUTIVE_GOVERNANCE_V1",
    decision,
    reason,
    executionGranted: decision === "ALLOW_CONTROLLED_EXECUTION",
    auditRequired: true,
    ...extra
  });
}

/**
 * Evaluate a proposed action before any executor/connector is invoked.
 * Unknown actions are denied. This policy is not a substitute for route-level
 * authentication, ownership checks, transaction controls or provider verification.
 */
export function evaluateSupraAction(input = {}) {
  const actionType = typeof input.actionType === "string"
    ? input.actionType.trim().toUpperCase()
    : "";

  if (!actionType) {
    return result("DENY", "ACTION_TYPE_REQUIRED");
  }

  if (ANALYSIS_ACTIONS.has(actionType)) {
    return result("ALLOW_ANALYSIS_ONLY", "NON_MUTATING_ANALYSIS", {
      executionGranted: false
    });
  }

  if (NEVER_AUTONOMOUS_ACTIONS.has(actionType)) {
    return result("BLOCK_AUTONOMOUS", "HUMAN_PROFESSIONAL_DECISION_REQUIRED");
  }

  if (REVERSIBLE_INTERNAL_ACTIONS.has(actionType)) {
    const lowRisk = String(input.riskLevel || "").toUpperCase() === "LOW";
    const reversible = input.reversible === true;
    const preauthorized = input.preauthorized === true;
    const idempotencyValid = nonEmptyString(input.idempotencyKey) &&
      input.idempotencyKey.length <= 128;

    if (lowRisk && reversible && preauthorized && idempotencyValid) {
      return result("ALLOW_CONTROLLED_EXECUTION", "PREAUTHORIZED_LOW_RISK_REVERSIBLE_ACTION");
    }

    if (approvedByManager(input.humanApproval) && idempotencyValid) {
      return result("ALLOW_CONTROLLED_EXECUTION", "MANAGER_APPROVED_INTERNAL_ACTION");
    }

    return result("REQUIRE_HUMAN_APPROVAL", "INTERNAL_ACTION_GATES_NOT_MET");
  }

  if (!HUMAN_GATED_ACTIONS.has(actionType)) {
    return result("DENY", "UNKNOWN_ACTION_TYPE");
  }

  if (!approvedByManager(input.humanApproval)) {
    return result("REQUIRE_HUMAN_APPROVAL", "MANAGER_APPROVAL_REQUIRED");
  }

  if (FINANCIAL_ACTIONS.has(actionType)) {
    if (input.ledgerReady !== true || input.providerAuthorization !== true ||
        !nonEmptyString(input.idempotencyKey)) {
      return result("REQUIRE_HUMAN_APPROVAL", "FINANCIAL_LEDGER_PROVIDER_AND_IDEMPOTENCY_GATES_REQUIRED");
    }
  }

  if (actionType === "DATA_EXPORT" && input.privacyReviewPassed !== true) {
    return result("REQUIRE_HUMAN_APPROVAL", "PRIVACY_REVIEW_REQUIRED");
  }

  if (actionType === "DATA_ERASURE" && input.retentionReviewPassed !== true) {
    return result("REQUIRE_HUMAN_APPROVAL", "RETENTION_REVIEW_REQUIRED");
  }

  if (actionType === "SECURITY_POLICY_CHANGE" && input.securityReviewPassed !== true) {
    return result("REQUIRE_HUMAN_APPROVAL", "INDEPENDENT_SECURITY_REVIEW_REQUIRED");
  }

  if (actionType === "PRODUCTION_DEPLOY" &&
      (input.releaseGatePassed !== true || input.twoPersonApproval !== true)) {
    return result("REQUIRE_HUMAN_APPROVAL", "RELEASE_GATE_AND_TWO_PERSON_APPROVAL_REQUIRED");
  }

  return result("ALLOW_CONTROLLED_EXECUTION", "EXPLICIT_MANAGER_APPROVAL_AND_REQUIRED_GATES_PASSED");
}

export const supraGovernanceActionTypes = Object.freeze({
  analysis: Object.freeze([...ANALYSIS_ACTIONS]),
  reversibleInternal: Object.freeze([...REVERSIBLE_INTERNAL_ACTIONS]),
  humanGated: Object.freeze([...HUMAN_GATED_ACTIONS]),
  neverAutonomous: Object.freeze([...NEVER_AUTONOMOUS_ACTIONS])
});
