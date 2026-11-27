import test from "node:test";
import assert from "node:assert/strict";
import "../src/nexus-alert-cooldown.js";
const apply = globalThis.ProcheliaNexusAlertCooldown.applyAlertCooldown;
const t0 = "2026-11-27T20:00:00.000Z";
const alert = { code: "TASK_FAILURES", severity: "warning", count: 2 };
const base = { environment: "preview", scopeKey: "tenant-a", now: t0, cooldownSeconds: 300, alerts: [alert] };

test("first alert emits and returns caller-persistable state without identifiers", () => {
  const r = apply(base); assert.equal(r.ok, true); assert.deepEqual(r.emitted, [alert]); assert.deepEqual(r.suppressed, []);
  assert.equal(r.executionAllowed, false); assert.equal(r.mode, "READ_ONLY_ALERT_COOLDOWN");
  assert.doesNotMatch(JSON.stringify(r), /task-id|private|payload/);
});
test("duplicate within cooldown is suppressed deterministically", () => {
  const first = apply(base);
  const r = apply({ ...base, now: "2026-11-27T20:02:00.000Z", previousState: first.nextState });
  assert.deepEqual(r.emitted, []); assert.equal(r.suppressed.length, 1);
  assert.equal(r.nextState["tenant-a|TASK_FAILURES"].lastEmittedAt, t0);
});
test("severity escalation and increasing count bypass cooldown", () => {
  const first = apply(base);
  const escalated = apply({ ...base, now: "2026-11-27T20:01:00.000Z", alerts: [{ ...alert, severity: "critical" }], previousState: first.nextState });
  assert.equal(escalated.emitted.length, 1);
  const increased = apply({ ...base, now: "2026-11-27T20:01:00.000Z", alerts: [{ ...alert, count: 3 }], previousState: first.nextState });
  assert.equal(increased.emitted.length, 1);
});
test("after cooldown expires alert emits again", () => {
  const first = apply(base);
  const r = apply({ ...base, now: "2026-11-27T20:06:00.000Z", previousState: first.nextState });
  assert.equal(r.emitted.length, 1); assert.deepEqual(r.suppressed, []);
});
test("invalid state, malformed alerts, invalid time, and Production fail closed", () => {
  assert.equal(apply({ ...base, environment: "production" }).ok, false);
  assert.equal(apply({ ...base, now: "2026-02-30T20:00:00.000Z" }).ok, false);
  assert.equal(apply({ ...base, alerts: [{ ...alert, code: "injected pii" }] }).ok, false);
  assert.equal(apply({ ...base, previousState: { "tenant-a|TASK_FAILURES": { lastEmittedAt: "bad", lastCount: 2 } } }).ok, false);
});
test("scope separation and no alert does not alter state", () => {
  const first = apply(base);
  const other = apply({ ...base, scopeKey: "tenant-b", now: "2026-11-27T20:01:00.000Z", previousState: first.nextState });
  assert.equal(other.emitted.length, 1);
  const empty = apply({ ...base, alerts: [], previousState: first.nextState });
  assert.deepEqual(empty.emitted, []); assert.deepEqual(empty.suppressed, []);
});
