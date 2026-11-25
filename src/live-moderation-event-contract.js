// Nexus Supra — trusted live-event contract.
// This is a server-internal planning boundary only. It has no live-control adapters,
// persistence, network calls, or side effects. Never accept the trust context from HTTP input.
import { evaluateLiveMessage, LIVE_MODERATION_POLICY_VERSION } from "./live-moderation-policy.js";

const REQUIRED_IDS = ["tenantId", "liveId", "hostId", "messageId", "authorId", "eventId"];
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const MAX_RECENT_VIOLATIONS = 20;
const TIMEOUT_MINUTES = Object.freeze({
  temporary_live_timeout: 10,
  temporary_live_timeout_5m: 5,
  temporary_live_timeout_30m: 30,
  suspend_user_from_live_24h: 1440
});

function fail(code) {
  const error = new TypeError(code);
  error.code = code;
  throw error;
}

function requireId(value, field) {
  if (typeof value !== "string" || !ID_PATTERN.test(value) || value.trim() !== value) {
    fail("INVALID_" + field.toUpperCase());
  }
  return value;
}

/**
 * Builds a sanitized action plan from a gateway-verified message event.
 *
 * The trustContext MUST be created by the server live gateway after it has checked
 * tenant membership, live ownership and author identity. This function deliberately
 * does not implement those checks against a database. It verifies the claims are
 * present and match the event, and rejects mismatches fail-closed.
 *
 * Caller-supplied violation counts are not accepted: the count is read only from the
 * server trustContext. No original message text is returned. This is plan-only.
 */
export function buildTrustedLiveModerationPlan({ event, trustContext, profile = "standard" } = {}) {
  if (!event || typeof event !== "object" || Array.isArray(event)) fail("EVENT_REQUIRED");
  if (!trustContext || typeof trustContext !== "object" || Array.isArray(trustContext)) fail("TRUST_CONTEXT_REQUIRED");

  const eventIds = Object.fromEntries(REQUIRED_IDS.map((field) => [field, requireId(event[field], field)]));
  if (trustContext.source !== "verified_live_gateway" ||
      trustContext.tenantMembershipVerified !== true ||
      trustContext.liveOwnerVerified !== true ||
      trustContext.messageAuthorVerified !== true) {
    fail("TRUST_VERIFICATION_REQUIRED");
  }

  const trustedIds = {
    tenantId: requireId(trustContext.tenantId, "trusted_tenant"),
    liveId: requireId(trustContext.liveId, "trusted_live"),
    hostId: requireId(trustContext.hostId, "trusted_host"),
    authorId: requireId(trustContext.authorId, "trusted_author")
  };
  for (const field of ["tenantId", "liveId", "hostId", "authorId"]) {
    if (eventIds[field] !== trustedIds[field]) fail("TRUST_SCOPE_MISMATCH");
  }

  const recentViolations = trustContext.recentViolations ?? 0;
  if (!Number.isInteger(recentViolations) || recentViolations < 0 || recentViolations > MAX_RECENT_VIOLATIONS) {
    fail("INVALID_TRUSTED_VIOLATION_COUNT");
  }

  const evaluation = evaluateLiveMessage(event.text, { profile, recentViolations });
  if (!evaluation.ok) {
    return {
      ok: false,
      error: evaluation.error,
      policy_version: evaluation.policy_version,
      execution: "plan_only"
    };
  }

  const actionPlan = evaluation.actions.map((action) => {
    if (action === "pause_live_for_review") {
      return { type: action, scope: "live", requiresHostApproval: true, execution: "not_connected" };
    }
    if (Object.hasOwn(TIMEOUT_MINUTES, action)) {
      return {
        type: "temporary_timeout",
        scope: "live_user",
        duration_minutes: TIMEOUT_MINUTES[action],
        source_action: action,
        execution: "not_connected"
      };
    }
    const scope = action === "redact_personal_data" || action === "exclude_from_replay"
      ? "replay"
      : action === "block_message"
        ? "message"
        : action === "warn_user" || action === "notify_live_host" || action === "create_safety_incident"
          ? "live_user_or_host"
          : "unknown";
    return { type: action, scope, execution: "not_connected" };
  });

  return {
    ok: true,
    policy_version: LIVE_MODERATION_POLICY_VERSION,
    event_scope: {
      tenant_id: eventIds.tenantId,
      live_id: eventIds.liveId,
      host_id: eventIds.hostId,
      message_id: eventIds.messageId,
      author_id: eventIds.authorId
    },
    idempotency_key: "live-mod:" + LIVE_MODERATION_POLICY_VERSION + ":" + eventIds.tenantId + ":" + eventIds.liveId + ":" + eventIds.eventId,
    evaluation: {
      decision: evaluation.decision,
      severity: evaluation.severity,
      reason_codes: evaluation.reason_codes,
      categories: evaluation.categories
    },
    action_plan: actionPlan,
    requires_host_review: actionPlan.some((action) => action.requiresHostApproval === true),
    permanent_account_suspension: false,
    execution: "plan_only",
    live_controls_connected: false
  };
}

export default buildTrustedLiveModerationPlan;
