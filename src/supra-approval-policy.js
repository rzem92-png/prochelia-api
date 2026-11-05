// SUPRA approval decision lifecycle — pure policy/state validation.
// Persistence, authenticated actor verification, atomic consume, and action execution
// MUST be provided by a trusted server adapter. This module never executes actions.
const ALLOWED_DECISIONS = new Set(["approve", "reject", "request_more_evidence"]);
const MAX_CLOCK_SKEW_MS = 60_000;

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function nonEmpty(value, max = 128) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
function safeTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function validateSupraApprovalDecision(input, trusted = {}) {
  if (!plain(input) || !plain(trusted)) return { ok: false, code: "INVALID_INPUT" };
  const required = ["caseId", "proposalId", "proposalVersion", "fingerprint", "decision", "approvalId", "expiresAt", "createdAt"];
  if (required.some(key => input[key] === undefined) ||
      !nonEmpty(input.caseId) || !nonEmpty(input.proposalId) ||
      !(typeof input.proposalVersion === "string" || Number.isSafeInteger(input.proposalVersion)) ||
      !nonEmpty(input.fingerprint, 64) || !/^[a-f0-9]{64}$/.test(input.fingerprint) ||
      !nonEmpty(input.approvalId) || !ALLOWED_DECISIONS.has(input.decision) ||
      !safeTime(input.expiresAt) || !safeTime(input.createdAt)) {
    return { ok: false, code: "INVALID_APPROVAL_RECORD" };
  }

  // Actor and current server state must come from trusted authentication/storage,
  // never from browser-submitted fields.
  if (trusted.authenticated !== true || trusted.actorRole !== "gerante" ||
      !nonEmpty(trusted.actorId) || trusted.caseId !== input.caseId ||
      trusted.proposalId !== input.proposalId || trusted.proposalVersion !== input.proposalVersion ||
      trusted.fingerprint !== input.fingerprint) {
    return { ok: false, code: "TRUSTED_CONTEXT_MISMATCH" };
  }
  if (trusted.currentStatus !== "approval_required") return { ok: false, code: "CASE_NOT_AWAITING_APPROVAL" };
  if (trusted.alreadyConsumed === true) return { ok: false, code: "APPROVAL_ALREADY_CONSUMED" };

  const now = Number.isFinite(trusted.nowMs) ? trusted.nowMs : Date.now();
  const created = Date.parse(input.createdAt);
  const expires = Date.parse(input.expiresAt);
  if (created > now + MAX_CLOCK_SKEW_MS) return { ok: false, code: "APPROVAL_CREATED_IN_FUTURE" };
  if (expires <= now) return { ok: false, code: "APPROVAL_EXPIRED" };
  if (expires <= created) return { ok: false, code: "INVALID_APPROVAL_EXPIRY" };
  if (expires - created > 24 * 60 * 60 * 1000) return { ok: false, code: "APPROVAL_TTL_TOO_LONG" };

  return {
    ok: true,
    decision: input.decision,
    approvalId: input.approvalId,
    actorId: trusted.actorId,
    caseId: input.caseId,
    proposalId: input.proposalId,
    proposalVersion: input.proposalVersion,
    fingerprint: input.fingerprint,
    consumeAtomically: true,
    executionAllowed: false,
    nextStep: input.decision === "approve" ? "HUMAN_APPROVED_AWAITING_SERVER_POLICY" :
      input.decision === "reject" ? "REJECTED" : "REQUEST_MORE_EVIDENCE"
  };
}
