import test from "node:test";
import assert from "node:assert/strict";
import { createLiveSession, transitionLiveSession, START_GATES } from "../src/live-lifecycle-safety-control.js";

const gates = Object.fromEntries(START_GATES.map((key) => [key, true]));
const make = () => createLiveSession({ id: "live-1", tenantId: "tenant-1", creatorId: "creator-1" });
const command = (type, actorRole = "creator", extras = {}) => ({ eventId: crypto.randomUUID(), type, actorRole, actorId: actorRole === "creator" ? "creator-1" : "system-1", ...extras });
const start = (s = make()) => transitionLiveSession(s, command("start", "creator", { gates })).session;

test("new LIVE starts disabled/fail closed", () => {
  const s = make();
  assert.equal(s.state, "ready");
  assert.equal(s.controls.publishEnabled, false);
  assert.equal(s.controls.distributionEnabled, false);
  assert.equal(s.controls.giftsEnabled, false);
});
test("start enables only after all gates", () => {
  const r = transitionLiveSession(make(), command("start", "creator", { gates }));
  assert.equal(r.session.state, "live");
  assert.equal(r.session.controls.publishEnabled, true);
  assert.ok(r.actions.includes("enable_distribution"));
});
test("start blocked when a gate is missing/false", () => {
  const bad = { ...gates, detectors_healthy: false };
  assert.throws(() => transitionLiveSession(make(), command("start", "creator", { gates: bad })), { code: "START_GATES_FAILED" });
});
test("unauthorized user cannot start", () => {
  assert.throws(() => transitionLiveSession(make(), command("start", "creator", { actorId: "attacker", gates })), { code: "FORBIDDEN" });
});
test("safety pause turns off publish, distribution, gifts and guest publishing", () => {
  const s = start();
  const r = transitionLiveSession(s, command("safety_pause", "moderation_system", {
    policyDecision: { action: "pause", policyVersion: "policy-2026.1", reasonCode: "drug_use_visible" },
  }));
  assert.equal(r.session.state, "paused_safety");
  for (const k of ["publishEnabled", "distributionEnabled", "giftsEnabled", "guestPublishingEnabled"]) assert.equal(r.session.controls[k], false);
  for (const action of ["disable_publish", "disable_distribution", "disable_gifts", "create_incident_case"]) assert.ok(r.actions.includes(action));
});
test("safety pause requires versioned decision", () => {
  assert.throws(() => transitionLiveSession(start(), command("safety_pause", "moderation_system", { policyDecision: { action: "pause" } })), { code: "MISSING_POLICY_DECISION" });
});
test("high impact decision may terminate stream", () => {
  const r = transitionLiveSession(start(), command("safety_pause", "moderation_system", {
    policyDecision: { action: "end", policyVersion: "p1", reasonCode: "critical_violation" },
  }));
  assert.equal(r.session.state, "ended");
  assert.ok(r.actions.includes("terminate_stream"));
});
test("detector failure pauses fail-closed and monetization", () => {
  const r = transitionLiveSession(start(), command("technical_pause", "system", { reasonCode: "detector_unavailable" }));
  assert.equal(r.session.state, "paused_technical");
  assert.equal(r.session.controls.giftsEnabled, false);
  assert.ok(r.actions.includes("alert_operations"));
});
test("resume requires explicit all-clear gates", () => {
  const paused = transitionLiveSession(start(), command("technical_pause", "system", { reasonCode: "media_path_unhealthy" })).session;
  assert.throws(() => transitionLiveSession(paused, command("resume", "creator", { resumeChecks: { allClear: true } })), { code: "RESUME_GATES_FAILED" });
});
test("authorized resume re-enables only requested controls", () => {
  const paused = transitionLiveSession(start(), command("technical_pause", "system", { reasonCode: "detector_unavailable" })).session;
  const r = transitionLiveSession(paused, command("resume", "moderator", { resumeChecks: { allClear: true, detectorsHealthy: true, policyCurrent: true, incidentAcknowledged: true, monetizationAllowed: false, guestPublishingAllowed: false } }));
  assert.equal(r.session.state, "live");
  assert.equal(r.session.controls.giftsEnabled, false);
  assert.equal(r.session.controls.guestPublishingEnabled, false);
});
test("duplicate event is idempotent", () => {
  const s = make(); const c = command("start", "creator", { gates });
  const once = transitionLiveSession(s, c);
  const twice = transitionLiveSession(once.session, c);
  assert.equal(twice.outcome, "duplicate");
  assert.equal(twice.session.history.length, 1);
});
test("creator can end; unauthorized cannot", () => {
  const s = start();
  assert.throws(() => transitionLiveSession(s, command("end", "creator", { actorId: "other" })), { code: "FORBIDDEN" });
  const r = transitionLiveSession(s, command("end", "creator"));
  assert.equal(r.session.state, "ended");
  assert.equal(r.session.controls.giftsEnabled, false);
});
test("unknown command fails closed", () => {
  assert.throws(() => transitionLiveSession(make(), command("anything")), { code: "UNKNOWN_COMMAND" });
});

test("human review release is required after review state and disables monetization/guests", () => {
  const s = start();
  const paused = transitionLiveSession(s, command("safety_pause", "moderation_system", {
    policyDecision: { action: "review", policyVersion: "p1", reasonCode: "uncertain_sensitive_content" },
  })).session;
  const checks = { allClear: true, detectorsHealthy: true, policyCurrent: true, incidentAcknowledged: true, identityVerified: true, ageEligible: true, territoryAllowed: true, consentValid: true, chatModerationReady: true };
  const released = transitionLiveSession(paused, command("review_release", "moderator", {
    reviewDecision: { result: "clear", reviewerId: "human-reviewer-1", policyVersion: "p2" }, resumeChecks: checks,
  }));
  assert.equal(released.session.state, "live");
  assert.equal(released.session.controls.giftsEnabled, false);
  assert.equal(released.session.controls.guestPublishingEnabled, false);
  assert.ok(released.actions.includes("close_incident"));
});
test("review release cannot be automated or bypass safety gates", () => {
  const paused = transitionLiveSession(start(), command("safety_pause", "moderation_system", {
    policyDecision: { action: "review", policyVersion: "p1", reasonCode: "uncertain" },
  })).session;
  assert.throws(() => transitionLiveSession(paused, command("review_release", "system", {
    reviewDecision: { result: "clear", reviewerId: "reviewer", policyVersion: "p2" }, resumeChecks: { allClear: true },
  })), { code: "FORBIDDEN" });
});
test("human confirms violation: terminate and queue sanction review, not automatic permanent ban", () => {
  const paused = transitionLiveSession(start(), command("safety_pause", "moderation_system", {
    policyDecision: { action: "review", policyVersion: "p1", reasonCode: "suspicious" },
  })).session;
  const r = transitionLiveSession(paused, command("review_release", "moderator", {
    reviewDecision: { result: "confirmed_violation", reviewerId: "reviewer-1", policyVersion: "p2" },
  }));
  assert.equal(r.session.state, "ended");
  assert.ok(r.actions.includes("queue_sanction_review"));
});
