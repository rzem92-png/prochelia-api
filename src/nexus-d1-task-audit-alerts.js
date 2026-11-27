/* Pure, privacy-minimized alert evaluation for Nexus D1 task/audit scans.
 * Preview/dev/test only. No D1 access, no execution, and no task IDs in output.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProcheliaNexusD1TaskAuditAlerts = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  const ENVS = new Set(["preview", "development", "test"]);
  const STATES = ["RECEIVED", "PLANNED", "AUTHORIZED", "QUEUED", "RUNNING", "VERIFYING", "RETRY_WAIT", "COMPLETED", "FAILED", "ESCALATED", "CANCELLED"];
  const FINDING_CODES = new Set([
    "SNAPSHOT_SCOPE_OR_ID_INVALID", "SNAPSHOT_STATE_INVALID", "SNAPSHOT_REVISION_INVALID",
    "TASK_NOT_FOUND", "TASK_SCOPE_MISMATCH", "TASK_EVENT_LIMIT", "TASK_SNAPSHOT_INVALID",
    "TASK_EVENT_INTEGRITY_FAILED", "AUDIT_HEAD_NOT_FOUND", "AUDIT_HEAD_INVALID",
    "AUDIT_EVENT_LIMIT", "AUDIT_EVENT_INTEGRITY_FAILED", "AUDIT_HEAD_MISMATCH",
    "TASK_AUDIT_LINK_MISSING", "AUDIT_VERIFY_FAILED", "D1_READ_FAILED", "INPUT_INVALID",
    "AUDIT_API_UNAVAILABLE", "D1_SCAN_FAILED", "D1_SCAN_RESULT_INVALID", "PAIR_VERIFICATION_FAILED"
  ]);
  const ERROR_CODES = new Set(["D1_SCAN_FAILED", "D1_SCAN_RESULT_INVALID", "READER_API_UNAVAILABLE", "INPUT_INVALID"]);
  function plain(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Object.getOwnPropertySymbols(value).length === 0 &&
      Object.keys(descriptors).every(key => descriptors[key].enumerable && Object.hasOwn(descriptors[key], "value"));
  }
  function scopeKey(tenantId) { return tenantId ?? "__GLOBAL__"; }
  function invalid() {
    return { ok: false, status: "UNKNOWN", severity: "critical", alertRequired: true, humanReviewRequired: true,
      alerts: [{ code: "INPUT_INVALID", severity: "critical", count: 1,
        recommendation: "Validate the scan envelope and scope, then rerun in a permitted non-production environment." }],
      executionAllowed: false, mode: "READ_ONLY_ALERT_EVALUATION" };
  }
  function safeError(error) { return ERROR_CODES.has(error) ? error : "SCAN_UNAVAILABLE"; }
  function validTime(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  }
  function evaluateTaskAuditScanAlerts(input = {}) {
    if (!plain(input) || !plain(input.scan) || !ENVS.has(input.environment) ||
        !Object.hasOwn(input, "tenantId") || (input.tenantId !== null && !ID.test(input.tenantId)) ||
        !validTime(input.evaluatedAt)) return invalid();
    const tenantId = input.tenantId ?? null, environment = input.environment;
    const scan = input.scan;
    if (scan.ok !== false && (scan.ok !== true || scan.mode !== "READ_ONLY_INTEGRITY_SCAN" || scan.executionAllowed !== false ||
        scan.environment !== environment || scan.tenantId !== tenantId || scan.scopeKey !== scopeKey(tenantId) ||
        !Number.isSafeInteger(scan.scanned) || scan.scanned < 0 || !Number.isSafeInteger(scan.verified) || scan.verified < 0 ||
        !Number.isSafeInteger(scan.failed) || scan.failed < 0 || scan.verified + scan.failed !== scan.scanned ||
        typeof scan.truncated !== "boolean" || typeof scan.cursorBlocked !== "boolean" ||
        scan.healthy !== (scan.failed === 0 && !scan.truncated) || (scan.cursorBlocked && !scan.truncated) ||
        !plain(scan.byState) ||
        !STATES.every(state => Number.isSafeInteger(scan.byState[state]) && scan.byState[state] >= 0) ||
        STATES.reduce((sum, state) => sum + scan.byState[state], 0) !== scan.verified ||
        !Array.isArray(scan.findings) || scan.findings.length > 50 || scan.findings.length !== scan.failed ||
        scan.findings.some(f => !plain(f) || typeof f.code !== "string"))) return invalid();
    const alerts = [];
    const add = (code, severity, count, recommendation) => alerts.push({ code, severity, count, recommendation });
    if (scan.ok !== true) {
      add(safeError(scan.error), "critical", 1, "Read-only scan unavailable: restore Preview/dev/test reader access and rerun; keep the scope marked UNKNOWN.");
    } else {
      if (scan.failed > 0) add("INTEGRITY_FAILURE", "critical", scan.failed,
        "Pause automated execution for the affected scope and have an authorized operator inspect the task/audit evidence.");
      if (scan.truncated || scan.cursorBlocked) add("SCAN_INCOMPLETE", "warning", 1,
        "Continue the bounded keyset scan from its returned cursor; do not mark the scope healthy until all pages verify.");
      if (scan.byState.ESCALATED > 0) add("HUMAN_ESCALATION_PENDING", "high", scan.byState.ESCALATED,
        "Assign an authorized human owner and record the escalation outcome; Nexus must not decide the case autonomously.");
      if (scan.byState.FAILED > 0) add("TASK_FAILURES", "warning", scan.byState.FAILED,
        "Review failed task outcomes and retry only through the bounded, permission-checked lifecycle policy.");
      const findingCounts = {};
      for (const finding of scan.findings) {
        const code = FINDING_CODES.has(finding.code) ? finding.code : "UNKNOWN_FINDING_CODE";
        findingCounts[code] = (findingCounts[code] || 0) + 1;
      }
      if (scan.failed > 0 && Object.keys(findingCounts).length === 0) findingCounts.PAIR_VERIFICATION_FAILED = scan.failed;
      const highest = alerts.some(a => a.severity === "critical") ? "critical" :
        alerts.some(a => a.severity === "high") ? "high" : alerts.some(a => a.severity === "warning") ? "warning" : "info";
      return {
        ok: true, status: highest === "critical" ? "CRITICAL" : highest === "high" || highest === "warning" ? "DEGRADED" : "HEALTHY",
        severity: highest, alertRequired: alerts.length > 0,
        humanReviewRequired: alerts.some(a => ["critical", "high"].includes(a.severity)),
        scope: { tenantId, scopeKey: scopeKey(tenantId), environment }, evaluatedAt: input.evaluatedAt,
        summary: { scanned: scan.scanned, verified: scan.verified, failed: scan.failed, truncated: scan.truncated,
          cursorBlocked: scan.cursorBlocked, byState: Object.fromEntries(STATES.map(state => [state, scan.byState[state]])), findingCounts },
        alerts, executionAllowed: false, mode: "READ_ONLY_ALERT_EVALUATION"
      };
    }
    return { ok: true, status: "UNKNOWN", severity: "critical", alertRequired: true, humanReviewRequired: true,
      scope: { tenantId, scopeKey: scopeKey(tenantId), environment }, evaluatedAt: input.evaluatedAt,
      summary: { scanned: 0, verified: 0, failed: 0, truncated: false, cursorBlocked: false, byState: Object.fromEntries(STATES.map(state => [state, 0])), findingCounts: {} },
      alerts, executionAllowed: false, mode: "READ_ONLY_ALERT_EVALUATION" };
  }
  return Object.freeze({ evaluateTaskAuditScanAlerts });
});
