(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProcheliaNexusTaskAuditBridge = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  const HASH = /^[a-f0-9]{64}$/i;
  const HIGH_RISK = new Set(["FINANCIAL", "PSP", "BANKING", "LEGAL", "TAX", "SENSITIVE_KYC", "PERSONAL_SENSITIVE", "IRREVERSIBLE", "SECURITY_CHANGE", "COUNTRY_ACTIVATION"]);
  const CRITICAL = new Set(["FINANCIAL", "PSP", "BANKING", "LEGAL", "TAX", "IRREVERSIBLE", "SECURITY_CHANGE", "COUNTRY_ACTIVATION"]);
  const OUTCOME = Object.freeze({ RECEIVED: "OBSERVED", PLANNED: "OBSERVED", AUTHORIZED: "APPROVED", QUEUED: "QUEUED", RUNNING: "STARTED", VERIFYING: "OBSERVED", RETRY_WAIT: "OBSERVED", COMPLETED: "VERIFIED", FAILED: "FAILED", ESCALATED: "ESCALATED", CANCELLED: "CANCELLED" });
  const RISK_CLASSES = new Set(["READ", "WRITE", "OPS", "SUPPORT", "PRODUCT", "DEVELOPMENT", ...HIGH_RISK]);
  const STATES = new Set(Object.keys(OUTCOME));
  function id(value) { return typeof value === "string" && ID.test(value); }
  function object(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Object.getOwnPropertySymbols(value).length === 0 && Object.keys(descriptors).every(key => descriptors[key].enumerable && Object.hasOwn(descriptors[key], "value"));
  }
  function safeArray(value, maximum = 20) {
    if (!Array.isArray(value) || Object.getOwnPropertySymbols(value).length) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).filter(key => key !== "length");
    return value.length <= maximum && keys.length === value.length && keys.every(key => /^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length && descriptors[key].enumerable && Object.hasOwn(descriptors[key], "value"));
  }
  function fail(error, extra = {}) { return { ok: false, error, ...extra }; }
  function risk(value) {
    if (CRITICAL.has(value)) return "CRITICAL";
    if (HIGH_RISK.has(value)) return "HIGH";
    if (value === "READ" || value === "DEVELOPMENT") return "LOW";
    return "MEDIUM";
  }
  function mapTaskLifecycleEvent(task, event) {
    if (!object(task) || !object(event) || !object(event.metadata ?? {})) return fail("INPUT_INVALID");
    const metadata = event.metadata ?? {};
    if (!id(task.taskId) || !id(task.agentId) || !id(task.taskType) || !id(task.correlationId) || !RISK_CLASSES.has(task.riskClass) ||
        !["preview", "development", "test"].includes(task.environment) ||
        (task.tenantId !== null && task.tenantId !== undefined && !id(task.tenantId)) ||
        event.taskId !== task.taskId || event.tenantId !== (task.tenantId ?? null) ||
        event.environment !== task.environment || event.correlationId !== task.correlationId ||
        !id(event.eventId) || !id(event.actorId) || !["SYSTEM", "AGENT", "HUMAN"].includes(event.actorType) ||
        !STATES.has(event.to) || !id(event.to) || (event.from !== null && event.from !== undefined && !STATES.has(event.from)) ||
        !Number.isSafeInteger(event.sequence) || event.sequence < 1 || !Number.isSafeInteger(event.revision) || event.revision < 1 ||
        typeof event.occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.occurredAt) || !Number.isFinite(Date.parse(event.occurredAt)) || new Date(Date.parse(event.occurredAt)).toISOString() !== event.occurredAt) return fail("TASK_EVENT_INVALID");
    if (metadata.authorization !== undefined && !object(metadata.authorization)) return fail("AUTHORIZATION_INVALID");
    const authorization = metadata.authorization ?? {};
    const approvals = metadata.approvalIds ?? authorization.approvalIds ?? [];
    if (!safeArray(approvals, 5) || !approvals.every(id) || new Set(approvals).size !== approvals.length) return fail("APPROVALS_INVALID");
    if (metadata.evidenceRefs !== undefined && !safeArray(metadata.evidenceRefs)) return fail("EVIDENCE_REFS_INVALID");
    if (event.to === "AUTHORIZED" && HIGH_RISK.has(task.riskClass)) {
      const minimum = ["FINANCIAL", "PSP", "BANKING"].includes(task.riskClass) ? 2 : 1;
      if (approvals.length < minimum) return fail("APPROVAL_QUORUM_MISSING");
    }
    const actionHash = authorization.actionHash ?? metadata.actionHash ?? task.actionHash ?? null;
    const resultHash = metadata.resultHash ?? task.resultHash ?? null;
    if (actionHash !== null && !HASH.test(actionHash)) return fail("ACTION_HASH_INVALID");
    if (resultHash !== null && !HASH.test(resultHash)) return fail("RESULT_HASH_INVALID");
    if (metadata.toolId !== undefined && !id(metadata.toolId)) return fail("TOOL_ID_INVALID");
    if (authorization.policyVersion !== undefined && !id(authorization.policyVersion)) return fail("POLICY_VERSION_INVALID");
    const evidenceKeys = ["planRef", "resultRef", "verificationId", "incidentId", "humanResolution", "queueId", "messageId", "leaseId", "decisionId"];
    const evidenceRefs = [...new Set([...(metadata.evidenceRefs ?? []), ...evidenceKeys.map(key => metadata[key])].filter(value => value !== undefined && value !== null))];
    if (evidenceRefs.length > 20 || !evidenceRefs.every(id)) return fail("EVIDENCE_REFS_INVALID");
    const details = {
      from: event.from ?? null,
      to: event.to,
      eventSequence: event.sequence,
      taskRevision: event.revision,
      attempt: Number.isSafeInteger(task.attempt) ? task.attempt : 0,
      taskType: task.taskType,
      riskClass: task.riskClass,
    };
    for (const key of ["failureCode", "reasonCode", "severity"]) if (metadata[key] !== undefined) {
      if (!id(metadata[key])) return fail("DETAILS_INVALID");
      details[key] = metadata[key];
    }
    const mapped = {
      eventId: event.eventId,
      actorId: event.actorId,
      actorType: event.actorType,
      eventType: `TASK_${event.to}`,
      domain: "NEXUS_TASKS",
      action: "STATE_TRANSITION",
      risk: risk(task.riskClass),
      approvalRequired: HIGH_RISK.has(task.riskClass),
      executionAllowed: false,
      environment: task.environment,
      tenantId: task.tenantId ?? null,
      correlationId: task.correlationId,
      taskId: task.taskId,
      agentId: task.agentId,
      toolId: id(metadata.toolId) ? metadata.toolId : null,
      policyVersion: id(authorization.policyVersion) ? authorization.policyVersion : null,
      actionHash,
      resultHash,
      approvalIds: approvals,
      evidenceRefs,
      outcome: OUTCOME[event.to],
      occurredAt: event.occurredAt,
      details,
    };
    return { ok: true, auditEvent: mapped };
  }
  async function appendTaskAuditEvent(ledger, task, event, auditApi) {
    if (!auditApi || typeof auditApi.appendAuditEvent !== "function") return fail("AUDIT_API_UNAVAILABLE");
    const mapped = mapTaskLifecycleEvent(task, event);
    if (!mapped.ok) return mapped;
    const appended = await auditApi.appendAuditEvent(ledger, mapped.auditEvent);
    if (!appended || appended.ok !== true) return fail("AUDIT_APPEND_FAILED", { cause: appended?.error ?? "UNKNOWN" });
    return { ok: true, duplicate: appended.duplicate === true, ledger: appended.ledger, auditEvent: appended.event ?? mapped.auditEvent };
  }
  return Object.freeze({ mapTaskLifecycleEvent, appendTaskAuditEvent });
});
