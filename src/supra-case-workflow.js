// SUPRA case workflow — deterministic state/permission guard.
// Pure functions only: persistence, auth and execution must be supplied by trusted server adapters.
// Never treat this module as proof that a case has been resolved.
const STATES = new Set([
  "new", "triaged", "waiting_user", "waiting_third_party", "planned",
  "approval_required", "in_progress", "verification_pending", "resolved",
  "reopened", "escalated", "closed"
]);

const TERMINAL = new Set(["closed"]);
const TRANSITIONS = Object.freeze({
  new: ["triaged", "escalated"],
  triaged: ["waiting_user", "waiting_third_party", "planned", "approval_required", "in_progress", "escalated"],
  waiting_user: ["triaged", "planned", "escalated", "closed"],
  waiting_third_party: ["triaged", "planned", "escalated", "closed"],
  planned: ["approval_required", "in_progress", "waiting_user", "escalated"],
  approval_required: ["planned", "in_progress", "escalated"],
  in_progress: ["verification_pending", "waiting_user", "waiting_third_party", "escalated"],
  verification_pending: ["resolved", "in_progress", "escalated"],
  resolved: ["reopened", "closed"],
  reopened: ["triaged", "in_progress", "escalated"],
  escalated: ["triaged", "waiting_user", "waiting_third_party", "planned", "closed"],
  closed: []
});

const HIGH_RISK_TYPES = new Set([
  "payment", "refund", "payout", "legal", "contract", "dispute",
  "complaint", "account_suspension", "personal_data", "security",
  "production", "migration", "deletion"
]);

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function boundedText(value, max = 200) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

export function createSupraCase(input = {}) {
  if (!plainObject(input) || !boundedText(input.caseId, 100) ||
      !boundedText(input.caseType, 80) || !boundedText(input.title, 200) ||
      !boundedText(input.actorId, 100) || !boundedText(input.actorRole, 40)) {
    return { ok: false, code: "INVALID_CASE_INPUT" };
  }
  const risk = HIGH_RISK_TYPES.has(input.caseType.trim().toLowerCase());
  return {
    ok: true,
    case: {
      caseId: input.caseId.trim(),
      caseType: input.caseType.trim().toLowerCase(),
      title: input.title.trim(),
      actorId: input.actorId.trim(),
      actorRole: input.actorRole.trim().toLowerCase(),
      state: "new",
      risk: risk ? "HIGH" : "NORMAL",
      createdAt: input.createdAt ?? null,
      updatedAt: input.createdAt ?? null,
      resolutionEvidence: null,
      audit: []
    }
  };
}

export function transitionSupraCase(current, nextState, options = {}) {
  if (!plainObject(current) || !STATES.has(current.state) || !STATES.has(nextState)) {
    return { ok: false, code: "INVALID_STATE" };
  }
  if (TERMINAL.has(current.state)) return { ok: false, code: "CASE_CLOSED" };
  if (!TRANSITIONS[current.state].includes(nextState)) {
    return { ok: false, code: "TRANSITION_NOT_ALLOWED" };
  }
  if (nextState === "resolved") {
    const evidence = options.resolutionEvidence;
    if (!plainObject(evidence) || !boundedText(evidence.source, 120) ||
        !boundedText(evidence.reference, 200) || !boundedText(evidence.verifiedBy, 100) ||
        typeof evidence.verifiedAt !== "string" || Number.isNaN(Date.parse(evidence.verifiedAt))) {
      return { ok: false, code: "RESOLUTION_EVIDENCE_REQUIRED" };
    }
    if (current.risk === "HIGH" && options.humanApproval !== true) {
      return { ok: false, code: "HUMAN_APPROVAL_REQUIRED" };
    }
  }
  const now = typeof options.now === "string" ? options.now : null;
  const auditEntry = {
    from: current.state,
    to: nextState,
    actorId: boundedText(options.actorId, 100) ? options.actorId.trim() : "system",
    at: now,
    reason: boundedText(options.reason, 300) ? options.reason.trim() : null
  };
  return {
    ok: true,
    case: {
      ...current,
      state: nextState,
      updatedAt: now ?? current.updatedAt,
      resolutionEvidence: nextState === "resolved" ? options.resolutionEvidence : current.resolutionEvidence,
      audit: [...(Array.isArray(current.audit) ? current.audit : []), auditEntry]
    }
  };
}

export function canSupraExecuteAction(action, policy = {}) {
  if (!boundedText(action, 100) || !plainObject(policy)) {
    return { allowed: false, reason: "INVALID_INPUT_FAIL_CLOSED" };
  }
  if (policy.executionAdapterReady !== true) {
    return { allowed: false, reason: "EXECUTION_ADAPTER_NOT_VERIFIED" };
  }
  if (policy.serverAuthorizationVerified !== true) {
    return { allowed: false, reason: "SERVER_AUTHORIZATION_REQUIRED" };
  }
  if (policy.idempotencyKeyVerified !== true) {
    return { allowed: false, reason: "IDEMPOTENCY_REQUIRED" };
  }
  if (HIGH_RISK_TYPES.has(action.trim().toLowerCase()) && policy.humanApproval !== true) {
    return { allowed: false, reason: "HUMAN_APPROVAL_REQUIRED" };
  }
  if (policy.sourceOfTruthVerified !== true) {
    return { allowed: false, reason: "SOURCE_OF_TRUTH_REQUIRED" };
  }
  return { allowed: true, reason: "POLICY_CHECKS_PASSED" };
}

export function getSupraCaseTransitions(state) {
  return STATES.has(state) ? [...TRANSITIONS[state]] : [];
}
