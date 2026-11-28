/**
 * PROCHÉLIA LIVE lifecycle safety control contract.
 * Pure deterministic reducer: NOT wired to transport, persistence, detectors or UI.
 * Runtime integration must authenticate actor, authorize tenant/session, persist
 * atomically, enforce idempotency, and execute transport actions before release.
 */
const STATES = Object.freeze(["ready", "live", "paused_safety", "paused_technical", "review_required", "ended"]);
const ROLES = Object.freeze(["creator", "moderator", "system", "moderation_system"]);

const START_GATES = Object.freeze([
  "identity_verified",
  "age_eligible",
  "territory_allowed",
  "consent_valid",
  "safety_policy_loaded",
  "detectors_healthy",
  "chat_moderation_ready",
  "monetization_controls_ready",
]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function validateSession(session) {
  if (!isPlainObject(session) || !STATES.includes(session.state)) fail("INVALID_SESSION", "Invalid LIVE session.");
  if (!Array.isArray(session.processedEventIds)) fail("INVALID_SESSION", "Missing idempotency ledger.");
  if (!isPlainObject(session.controls)) fail("INVALID_SESSION", "Missing control state.");
  return session;
}
function validateCommand(command) {
  if (!isPlainObject(command) || typeof command.eventId !== "string" || !command.eventId.trim()) {
    fail("INVALID_COMMAND", "A unique eventId is required.");
  }
  if (!ROLES.includes(command.actorRole)) fail("INVALID_ACTOR", "Unknown actor role.");
  if (typeof command.type !== "string") fail("INVALID_COMMAND", "Command type is required.");
}
function gateFailures(gates) {
  if (!isPlainObject(gates)) return START_GATES;
  return START_GATES.filter((key) => gates[key] !== true);
}
function withEvent(session, command, nextState, controls, detail = {}) {
  return {
    ...session,
    state: nextState,
    controls: { ...session.controls, ...controls },
    processedEventIds: [...session.processedEventIds, command.eventId],
    history: [...(session.history || []), {
      eventId: command.eventId,
      type: command.type,
      actorRole: command.actorRole,
      state: nextState,
      detail,
    }],
  };
}

export function createLiveSession({ id, tenantId, creatorId } = {}) {
  if (![id, tenantId, creatorId].every((v) => typeof v === "string" && v.trim())) {
    fail("INVALID_SESSION_IDENTITY", "Session, tenant and creator IDs are required.");
  }
  return {
    id, tenantId, creatorId, state: "ready",
    controls: { distributionEnabled: false, giftsEnabled: false, publishEnabled: false, guestPublishingEnabled: false },
    processedEventIds: [],
    history: [],
  };
}

/**
 * Apply one server-authorized command. Policy decisions must be supplied by a
 * separately authenticated policy engine; this reducer never classifies media.
 */
export function transitionLiveSession(sessionInput, command) {
  const session = validateSession(sessionInput);
  validateCommand(command);
  if (session.processedEventIds.includes(command.eventId)) {
    return { session, outcome: "duplicate", actions: [] };
  }

  const { type, actorRole } = command;
  const creatorOwns = command.actorId === session.creatorId;
  const actions = [];

  if (type === "start") {
    if (session.state !== "ready") fail("INVALID_TRANSITION", "Only a ready session can start.");
    if (actorRole !== "creator" || !creatorOwns) fail("FORBIDDEN", "Only the verified creator can start this LIVE.");
    const missing = gateFailures(command.gates);
    if (missing.length) fail("START_GATES_FAILED", `Start blocked: ${missing.join(", ")}`);
    const next = withEvent(session, command, "live", {
      publishEnabled: true, distributionEnabled: true, giftsEnabled: true, guestPublishingEnabled: true,
    }, { gates: "all_passed" });
    actions.push("enable_publish", "enable_distribution");
    if (command.gates.monetization_controls_ready === true) actions.push("enable_gifts");
    return { session: next, outcome: "applied", actions };
  }

  if (type === "safety_pause") {
    if (session.state !== "live") fail("INVALID_TRANSITION", "Safety pause requires an active LIVE.");
    if (!["moderation_system", "moderator", "system"].includes(actorRole)) fail("FORBIDDEN", "Safety pause requires an authorized control actor.");
    if (!isPlainObject(command.policyDecision) || !["pause", "end", "review"].includes(command.policyDecision.action)
      || typeof command.policyDecision.policyVersion !== "string" || !command.policyDecision.policyVersion) {
      fail("MISSING_POLICY_DECISION", "A versioned policy decision is required.");
    }
    const reason = typeof command.policyDecision.reasonCode === "string" ? command.policyDecision.reasonCode : "safety_review";
    const action = command.policyDecision.action;
    const target = action === "end" ? "ended" : action === "review" ? "review_required" : "paused_safety";
    const next = withEvent(session, command, target, {
      publishEnabled: false, distributionEnabled: false, giftsEnabled: false, guestPublishingEnabled: false,
    }, { reasonCode: reason, policyVersion: command.policyDecision.policyVersion, action });
    actions.push("disable_publish", "disable_distribution", "disable_gifts", "disable_guest_publish", "create_incident_case");
    if (action === "end") actions.push("terminate_stream");
    if (action === "review") actions.push("queue_human_review");
    return { session: next, outcome: "applied", actions };
  }

  if (type === "technical_pause") {
    if (session.state !== "live") fail("INVALID_TRANSITION", "Technical pause requires an active LIVE.");
    if (!["system", "moderation_system", "moderator"].includes(actorRole)) fail("FORBIDDEN", "Technical pause requires an authorized control actor.");
    if (!["detector_unavailable", "media_path_unhealthy", "control_plane_timeout", "policy_engine_unavailable"].includes(command.reasonCode)) {
      fail("INVALID_REASON", "Unsupported technical pause reason.");
    }
    const next = withEvent(session, command, "paused_technical", {
      publishEnabled: false, distributionEnabled: false, giftsEnabled: false, guestPublishingEnabled: false,
    }, { reasonCode: command.reasonCode });
    actions.push("disable_publish", "disable_distribution", "disable_gifts", "disable_guest_publish", "alert_operations");
    return { session: next, outcome: "applied", actions };
  }

  if (type === "review_release") {
    if (session.state !== "review_required") fail("INVALID_TRANSITION", "Human review release requires review_required state.");
    if (actorRole !== "moderator") fail("FORBIDDEN", "Only a human moderator can release a LIVE from review.");
    if (!isPlainObject(command.reviewDecision) || !["clear", "confirmed_violation"].includes(command.reviewDecision.result)
      || typeof command.reviewDecision.reviewerId !== "string" || !command.reviewDecision.reviewerId
      || typeof command.reviewDecision.policyVersion !== "string" || !command.reviewDecision.policyVersion) {
      fail("INVALID_REVIEW_DECISION", "A reviewer identity, result and policy version are required.");
    }
    if (command.reviewDecision.result === "confirmed_violation") {
      const next = withEvent(session, command, "ended", {
        publishEnabled: false, distributionEnabled: false, giftsEnabled: false, guestPublishingEnabled: false,
      }, { reviewResult: "confirmed_violation", reviewerId: command.reviewDecision.reviewerId, policyVersion: command.reviewDecision.policyVersion });
      actions.push("terminate_stream", "disable_publish", "disable_distribution", "disable_gifts", "disable_guest_publish", "finalize_incident", "notify_creator", "queue_sanction_review");
      return { session: next, outcome: "applied", actions };
    }
    const checks = command.resumeChecks;
    if (!isPlainObject(checks) || checks.allClear !== true || checks.detectorsHealthy !== true
      || checks.policyCurrent !== true || checks.incidentAcknowledged !== true
      || checks.identityVerified !== true || checks.ageEligible !== true
      || checks.territoryAllowed !== true || checks.consentValid !== true
      || checks.chatModerationReady !== true) {
      fail("REVIEW_RELEASE_GATES_FAILED", "Human release blocked until all safety, identity, age, territory, consent and moderation checks clear.");
    }
    const next = withEvent(session, command, "live", {
      publishEnabled: true, distributionEnabled: true, giftsEnabled: false, guestPublishingEnabled: false,
    }, { reviewResult: "clear", reviewerId: command.reviewDecision.reviewerId, policyVersion: command.reviewDecision.policyVersion });
    actions.push("enable_publish", "enable_distribution", "keep_gifts_disabled", "keep_guest_publish_disabled", "close_incident", "notify_creator");
    return { session: next, outcome: "applied", actions };
  }

  if (type === "resume") {
    if (!["paused_safety", "paused_technical"].includes(session.state)) fail("INVALID_TRANSITION", "Only a paused LIVE can resume.");
    if (!(actorRole === "creator" && creatorOwns) && !["moderator", "system"].includes(actorRole)) fail("FORBIDDEN", "Resume requires creator or authorized moderator.");
    if (!isPlainObject(command.resumeChecks) || command.resumeChecks.allClear !== true
      || command.resumeChecks.detectorsHealthy !== true || command.resumeChecks.policyCurrent !== true
      || command.resumeChecks.incidentAcknowledged !== true) {
      fail("RESUME_GATES_FAILED", "Resume blocked until all safety, detector, policy and incident gates clear.");
    }
    const next = withEvent(session, command, "live", {
      publishEnabled: true, distributionEnabled: true, giftsEnabled: command.resumeChecks.monetizationAllowed === true,
      guestPublishingEnabled: command.resumeChecks.guestPublishingAllowed === true,
    }, { resumeChecks: "all_passed" });
    actions.push("enable_publish", "enable_distribution");
    if (command.resumeChecks.monetizationAllowed === true) actions.push("enable_gifts");
    if (command.resumeChecks.guestPublishingAllowed === true) actions.push("enable_guest_publish");
    return { session: next, outcome: "applied", actions };
  }

  if (type === "end") {
    if (session.state === "ended") fail("INVALID_TRANSITION", "LIVE already ended.");
    if (!(actorRole === "creator" && creatorOwns) && !["moderator", "system", "moderation_system"].includes(actorRole)) {
      fail("FORBIDDEN", "Only creator or authorized control actor can end LIVE.");
    }
    const next = withEvent(session, command, "ended", {
      publishEnabled: false, distributionEnabled: false, giftsEnabled: false, guestPublishingEnabled: false,
    }, { reasonCode: command.reasonCode || "creator_or_moderator_end" });
    actions.push("disable_publish", "disable_distribution", "disable_gifts", "disable_guest_publish", "terminate_stream", "finalize_incident_if_open");
    return { session: next, outcome: "applied", actions };
  }

  fail("UNKNOWN_COMMAND", "Unsupported LIVE lifecycle command.");
}

export { STATES, START_GATES };
