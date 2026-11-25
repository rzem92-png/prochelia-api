import test from "node:test";
import assert from "node:assert/strict";
import { buildTrustedLiveModerationPlan } from "../src/live-moderation-event-contract.js";

const event = {
  tenantId: "tenant-7",
  liveId: "live-24",
  hostId: "host-3",
  messageId: "message-99",
  authorId: "user-8",
  eventId: "gateway-event-abc",
  text: "Je vais te tuer."
};
const trustContext = {
  source: "verified_live_gateway",
  tenantId: "tenant-7",
  liveId: "live-24",
  hostId: "host-3",
  authorId: "user-8",
  tenantMembershipVerified: true,
  liveOwnerVerified: true,
  messageAuthorVerified: true,
  recentViolations: 2
};

test("trusted event contract fails closed when trust context is missing", () => {
  assert.throws(() => buildTrustedLiveModerationPlan({ event }), { code: "TRUST_CONTEXT_REQUIRED" });
  assert.throws(() => buildTrustedLiveModerationPlan({ event, trustContext: { ...trustContext, source: "client" } }), { code: "TRUST_VERIFICATION_REQUIRED" });
  assert.throws(() => buildTrustedLiveModerationPlan({ event, trustContext: { ...trustContext, liveOwnerVerified: false } }), { code: "TRUST_VERIFICATION_REQUIRED" });
});

test("rejects cross-tenant, cross-live and mismatched author/host scopes", () => {
  for (const [key, value] of [
    ["tenantId", "tenant-other"],
    ["liveId", "live-other"],
    ["hostId", "host-other"],
    ["authorId", "user-other"]
  ]) {
    assert.throws(() => buildTrustedLiveModerationPlan({
      event: { ...event, [key]: value },
      trustContext
    }), { code: "TRUST_SCOPE_MISMATCH" });
  }
});

test("accepts a verified event and produces a plan-only threat response", () => {
  const result = buildTrustedLiveModerationPlan({ event, trustContext });
  assert.equal(result.ok, true);
  assert.equal(result.evaluation.decision, "block_and_pause_for_review");
  assert.equal(result.execution, "plan_only");
  assert.equal(result.live_controls_connected, false);
  assert.equal(result.requires_host_review, true);
  assert.ok(result.action_plan.some((action) => action.type === "pause_live_for_review" && action.requiresHostApproval));
  assert.ok(result.action_plan.some((action) => action.type === "temporary_timeout" && action.duration_minutes === 10));
  assert.equal(result.permanent_account_suspension, false);
  assert.ok(!JSON.stringify(result).includes(event.text));
});

test("personal-data plan contains replay protections but never the source text", () => {
  const privateEvent = { ...event, text: "Contact victime@example.com" };
  const result = buildTrustedLiveModerationPlan({ event: privateEvent, trustContext });
  assert.ok(result.evaluation.reason_codes.includes("email"));
  assert.ok(result.action_plan.some((action) => action.type === "redact_personal_data" && action.scope === "replay"));
  assert.ok(result.action_plan.some((action) => action.type === "exclude_from_replay" && action.scope === "replay"));
  assert.ok(!JSON.stringify(result).includes(privateEvent.text));
});

test("trusted recurrence count is bounded and never taken from event payload", () => {
  assert.throws(() => buildTrustedLiveModerationPlan({
    event: { ...event, recentViolations: 20 },
    trustContext: { ...trustContext, recentViolations: 21 }
  }), { code: "INVALID_TRUSTED_VIOLATION_COUNT" });
  const result = buildTrustedLiveModerationPlan({
    event: { ...event, recentViolations: 99 },
    trustContext: { ...trustContext, recentViolations: 0 }
  });
  assert.equal(result.action_plan.find((action) => action.type === "temporary_timeout").duration_minutes, 10);
});

test("safe factual discussion yields an empty action plan", () => {
  const result = buildTrustedLiveModerationPlan({
    event: { ...event, text: "Le procès doit établir les faits et protéger la victime." },
    trustContext
  });
  assert.equal(result.evaluation.decision, "allow");
  assert.deepEqual(result.action_plan, []);
});

test("event identifiers are validated and the idempotency key is stable and scope-bound", () => {
  const result = buildTrustedLiveModerationPlan({ event, trustContext });
  const same = buildTrustedLiveModerationPlan({ event, trustContext });
  assert.equal(result.idempotency_key, same.idempotency_key);
  assert.ok(result.idempotency_key.includes("tenant-7"));
  assert.throws(() => buildTrustedLiveModerationPlan({
    event: { ...event, eventId: "bad id" },
    trustContext
  }), { code: "INVALID_EVENT_ID" });
  const otherLive = buildTrustedLiveModerationPlan({
    event: { ...event, liveId: "live-25", hostId: "host-3" },
    trustContext: { ...trustContext, liveId: "live-25" }
  });
  assert.notEqual(result.idempotency_key, otherLive.idempotency_key);
});

test("rejects unbounded or malformed trusted violation counters and unknown profiles", () => {
  for (const value of [-1, 21, 1.5, "5"]) {
    assert.throws(() => buildTrustedLiveModerationPlan({
      event,
      trustContext: { ...trustContext, recentViolations: value }
    }), { code: "INVALID_TRUSTED_VIOLATION_COUNT" });
  }
  assert.throws(() => buildTrustedLiveModerationPlan({ event, trustContext, profile: "other" }), { code: "INVALID_PROFILE" });
});
