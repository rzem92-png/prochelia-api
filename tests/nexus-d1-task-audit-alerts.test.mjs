import test from "node:test";
import assert from "node:assert/strict";
import "../src/nexus-d1-task-audit-alerts.js";
const evaluate = globalThis.ProcheliaNexusD1TaskAuditAlerts.evaluateTaskAuditScanAlerts;
const stamp = "2026-11-27T20:00:00.000Z";
const base = { environment: "preview", tenantId: "tenant-a", evaluatedAt: stamp,
  scan: { ok: true, healthy: true, environment: "preview", tenantId: "tenant-a", scopeKey: "tenant-a",
    scanned: 2, verified: 2, failed: 0, truncated: false, cursorBlocked: false,
    byState: { RECEIVED: 0, PLANNED: 2, AUTHORIZED: 0, QUEUED: 0, RUNNING: 0, VERIFYING: 0, RETRY_WAIT: 0, COMPLETED: 0, FAILED: 0, ESCALATED: 0, CANCELLED: 0 },
    findings: [], executionAllowed: false, mode: "READ_ONLY_INTEGRITY_SCAN" } };
function make(overrides = {}) { return { ...base, scan: { ...base.scan, byState: { ...base.scan.byState }, ...overrides } }; }

test("verified complete scan yields healthy aggregate with no alert", () => {
  const result = evaluate(base);
  assert.equal(result.ok, true); assert.equal(result.status, "HEALTHY"); assert.equal(result.alertRequired, false);
  assert.equal(result.humanReviewRequired, false); assert.equal(result.summary.verified, 2); assert.equal(result.executionAllowed, false);
});

test("integrity failures create critical human-review alert and findings are code-only", () => {
  const result = evaluate(make({ healthy: false, failed: 1, verified: 1, scanned: 2,
    byState: { ...base.scan.byState, PLANNED: 1 }, findings: [{ taskId: "secret-task-id", code: "AUDIT_HEAD_MISMATCH", payload: "private" }] }));
  assert.equal(result.status, "CRITICAL"); assert.equal(result.severity, "critical"); assert.equal(result.humanReviewRequired, true);
  assert.equal(result.alerts[0].code, "INTEGRITY_FAILURE"); assert.equal(result.summary.findingCounts.AUDIT_HEAD_MISMATCH, 1);
  assert.doesNotMatch(JSON.stringify(result), /secret-task-id|private/);
});

test("truncated scan is degraded and cannot be represented as healthy", () => {
  const result = evaluate(make({ healthy: false, truncated: true }));
  assert.equal(result.status, "DEGRADED"); assert.equal(result.alerts[0].code, "SCAN_INCOMPLETE");
  assert.equal(result.humanReviewRequired, false); assert.equal(result.executionAllowed, false);
});

test("verified escalated tasks require human assignment; failed tasks generate warning", () => {
  const result = evaluate(make({ byState: { ...base.scan.byState, PLANNED: 0, ESCALATED: 1, FAILED: 1 } }));
  assert.equal(result.status, "DEGRADED"); assert.equal(result.humanReviewRequired, true);
  assert.deepEqual(result.alerts.map(a => a.code), ["HUMAN_ESCALATION_PENDING", "TASK_FAILURES"]);
});

test("unavailable scanner returns UNKNOWN critical with sanitized error", () => {
  const result = evaluate({ ...base, scan: { ok: false, error: "database password: fake", executionAllowed: false } });
  assert.equal(result.status, "UNKNOWN"); assert.equal(result.alerts[0].code, "SCAN_UNAVAILABLE");
  assert.equal(result.summary.scanned, null); assert.equal(result.summary.verified, null);
  assert.doesNotMatch(JSON.stringify(result), /database password/);
});

test("tenant/environment mismatch, inconsistent counts, invalid time and Production are fail-closed", () => {
  assert.equal(evaluate({ ...base, environment: "production" }).status, "UNKNOWN");
  assert.equal(evaluate({ ...base, tenantId: "tenant-b" }).status, "UNKNOWN");
  assert.equal(evaluate(make({ scanned: 2, verified: 1, failed: 0 })).status, "UNKNOWN");
  assert.equal(evaluate({ ...base, evaluatedAt: "2026-02-30T20:00:00.000Z" }).status, "UNKNOWN");
});

test("invalid or unknown finding codes are reduced to safe aggregate categories", () => {
  const result = evaluate(make({ healthy: false, failed: 1, verified: 1, scanned: 2,
    byState: { ...base.scan.byState, PLANNED: 1 }, findings: [{ code: "injected-text-and-pii" }] }));
  assert.equal(result.summary.findingCounts.UNKNOWN_FINDING_CODE, 1);
  assert.doesNotMatch(JSON.stringify(result), /injected-text-and-pii/);
});

test("scanner envelope requires finding counts to match failures and cursor-blocked scans to be incomplete", () => {
  assert.equal(evaluate(make({ failed: 1, verified: 1, scanned: 2, byState: { ...base.scan.byState, PLANNED: 1 }, findings: [] })).status, "UNKNOWN");
  assert.equal(evaluate(make({ truncated: false, cursorBlocked: true })).status, "UNKNOWN");
});
