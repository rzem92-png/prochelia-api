(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ProcheliaNexusAuditLedger = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const GENESIS = "0".repeat(64);
  const MAX_EVENTS = 200;
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  const HASH = /^[a-f0-9]{64}$/i;
  const ENVS = new Set(["preview", "development", "test"]);
  const RISKS = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  const ACTORS = new Set(["SYSTEM", "AGENT", "HUMAN"]);
  const OUTCOMES = new Set(["OBSERVED", "DENIED", "APPROVED", "QUEUED", "STARTED", "VERIFIED", "FAILED", "ESCALATED", "CANCELLED"]);
  const EVENT_KEYS = new Set(["eventId", "actorId", "actorType", "eventType", "domain", "action", "risk", "approvalRequired", "executionAllowed", "environment", "tenantId", "correlationId", "taskId", "agentId", "toolId", "policyVersion", "actionHash", "resultHash", "approvalIds", "evidenceRefs", "outcome", "occurredAt", "details"]);
  const RECORD_KEYS = [...EVENT_KEYS, "sequence", "previousHash", "hash"];
  const LEDGER_KEYS = ["schemaVersion", "environment", "tenantId", "revision", "headHash", "events"];

  function id(value) { return typeof value === "string" && ID.test(value); }
  function fail(error, extra = {}) { return { ok: false, error, ...extra }; }
  function freeze(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }

  // Accept JSON-like data only. Accessors, symbols, sparse arrays, unsafe keys,
  // non-finite numbers, custom prototypes and excessive nesting are rejected.
  function cloneSafe(value, depth = 0, nodes = { count: 0 }) {
    if (depth > 12 || ++nodes.count > 10000) throw Error("AUDIT_VALUE_LIMIT");
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw Error("AUDIT_NUMBER_INVALID");
      return Object.is(value, -0) ? 0 : value;
    }
    if (Array.isArray(value)) {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const keys = Object.getOwnPropertyNames(value).filter((key) => key !== "length");
      if (value.length > 100 || keys.length !== value.length ||
          keys.some((key) => !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length ||
            !Object.hasOwn(descriptors[key], "value") || !descriptors[key].enumerable) ||
          Object.getOwnPropertySymbols(value).length) throw Error("AUDIT_ARRAY_INVALID");
      return Array.from({ length: value.length }, (_, i) => cloneSafe(descriptors[String(i)].value, depth + 1, nodes));
    }
    if (value && typeof value === "object") {
      const prototype = Object.getPrototypeOf(value);
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const keys = Object.getOwnPropertyNames(value);
      if ((prototype !== Object.prototype && prototype !== null) || keys.length > 100 ||
          Object.getOwnPropertySymbols(value).length ||
          keys.some((key) => ["__proto__", "constructor", "prototype"].includes(key) ||
            !Object.hasOwn(descriptors[key], "value") || !descriptors[key].enumerable)) {
        throw Error("AUDIT_OBJECT_INVALID");
      }
      const copy = Object.create(null);
      for (const key of keys) copy[key] = cloneSafe(descriptors[key].value, depth + 1, nodes);
      return copy;
    }
    throw Error("AUDIT_VALUE_UNSUPPORTED");
  }

  function canonical(value) {
    if (value === null) return "null";
    if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "number") return JSON.stringify(Object.is(value, -0) ? 0 : value);
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
  }

  function timestamp(value) {
    if (Number.isSafeInteger(value) && value >= 0) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? new Date(parsed).toISOString() : null;
  }

  function rejectSecrets(value, depth = 0) {
    if (depth > 12) throw Error("AUDIT_VALUE_LIMIT");
    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) {
        if (/(?:secret|token|password|cookie|authorization|api[_-]?key|private[_-]?key)/i.test(key) {
          throw Error("AUDIT_SENSITIVE_FIELD_REJECTED");
        }
        rejectSecrets(value[key], depth + 1);
      }
    }
  }

  async function digest(value) {
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.subtle || typeof TextEncoder !== "function") throw Error("CRYPTO_UNAVAILABLE");
    const bytes = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function createLedger({ environment, tenantId = null } = {}) {
    if (typeof environment !== "string" || !ENVS.has(environment.toLowerCase())) return fail("ENVIRONMENT_DENIED");
    if (tenantId !== null && !id(tenantId)) return fail("TENANT_INVALID");
    return { ok: true, ledger: freeze({ schemaVersion: 1, environment: environment.toLowerCase(), tenantId, revision: 0, headHash: GENESIS, events: [] }) };
  }

  function normalizeEvent(raw, ledger) {
    let input;
    try {
      input = cloneSafe(raw);
      if (!input || Array.isArray(input) || typeof input !== "object") return fail("EVENT_INVALID");
      if (Object.keys(input).some((key) => !EVENT_KEYS.has(key))) return fail("EVENT_FIELD_UNKNOWN");
      rejectSecrets(input.details ?? {});
      if (input.details !== undefined && (!input.details || Array.isArray(input.details) || typeof input.details !== "object")) return fail("DETAILS_INVALID");
      if (input.approvalIds !== undefined && (!Array.isArray(input.approvalIds) || input.approvalIds.length > 5 || !input.approvalIds.every(id))) return fail("APPROVAL_IDS_INVALID");
      if (input.evidenceRefs !== undefined && (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length > 20 || !input.evidenceRefs.every(id))) return fail("EVIDENCE_REFS_INVALID");
    } catch (error) {
      return fail("EVENT_INPUT_INVALID", { detail: error.message });
    }

    const occurredAt = timestamp(input.occurredAt ?? Date.now());
    if (!id(input.eventId) || !id(input.actorId) || !ACTORS.has(input.actorType) ||
        !id(input.eventType) || !id(input.domain) || !id(input.action) || !RISKS.has(input.risk) ||
        typeof input.approvalRequired !== "boolean" || (input.executionAllowed !== undefined && input.executionAllowed !== false) ||
        typeof input.environment !== "string" || !ENVS.has(input.environment.toLowerCase()) ||
        input.environment.toLowerCase() !== ledger.environment ||
        (input.tenantId !== undefined && input.tenantId !== null && !id(input.tenantId)) ||
        (input.tenantId !== undefined && (input.tenantId ?? null) !== ledger.tenantId) ||
        !id(input.correlationId) ||
        (input.taskId !== undefined && input.taskId !== null && !id(input.taskId)) ||
        (input.agentId !== undefined && input.agentId !== null && !id(input.agentId)) ||
        (input.toolId !== undefined && input.toolId !== null && !id(input.toolId)) ||
        (input.policyVersion !== undefined && input.policyVersion !== null && !id(input.policyVersion)) ||
        (input.actionHash !== undefined && input.actionHash !== null && !HASH.test(input.actionHash)) ||
        (input.resultHash !== undefined && input.resultHash !== null && !HASH.test(input.resultHash)) ||
        (input.outcome !== undefined && !OUTCOMES.has(input.outcome)) || occurredAt === null) {
      return fail("EVENT_SCHEMA_INVALID");
    }

    const event = {
      eventId: input.eventId, actorId: input.actorId, actorType: input.actorType,
      eventType: input.eventType, domain: input.domain, action: input.action,
      risk: input.risk, approvalRequired: input.approvalRequired, executionAllowed: false,
      environment: ledger.environment, tenantId: ledger.tenantId, correlationId: input.correlationId,
      taskId: input.taskId ?? null, agentId: input.agentId ?? null, toolId: input.toolId ?? null,
      policyVersion: input.policyVersion ?? null, actionHash: input.actionHash ?? null,
      resultHash: input.resultHash ?? null, approvalIds: input.approvalIds ?? [],
      evidenceRefs: input.evidenceRefs ?? [], outcome: input.outcome ?? null,
      occurredAt, details: input.details ?? Object.create(null),
    };
    if (new TextEncoder().encode(canonical(event)).length > 6000) return fail("EVENT_TOO_LARGE");
    return { ok: true, event, explicitTime: Object.hasOwn(input, "occurredAt") };
  }

  async function verifyLedger(ledger) {
    try {
      if (!ledger || !Array.isArray(ledger.events) || ledger.events.length > MAX_EVENTS) return fail("LEDGER_SCHEMA_INVALID");
      const copy = cloneSafe(ledger);
      if (!copy || Object.keys(copy).sort().join("|") !== LEDGER_KEYS.slice().sort().join("|") ||
          copy.schemaVersion !== 1 || !ENVS.has(copy.environment) ||
          (copy.tenantId !== null && !id(copy.tenantId)) || copy.revision !== copy.events.length ||
          !HASH.test(copy.headHash || "")) return fail("LEDGER_SCHEMA_INVALID");
      let previous = GENESIS;
      for (let index = 0; index < copy.events.length; index++) {
        const record = copy.events[index];
        if (!record || Object.keys(record).sort().join("|") !== RECORD_KEYS.slice().sort().join("|") ||
            record.sequence !== index + 1 || record.previousHash !== previous ||
            record.environment !== copy.environment || record.tenantId !== copy.tenantId || !HASH.test(record.hash || "")) {
          return fail("LEDGER_CHAIN_INVALID", { index });
        }
        const { hash, sequence, previousHash, ...baseEvent } = record;
        const normalized = normalizeEvent(baseEvent, copy);
        if (!normalized.ok || canonical(normalized.event) !== canonical(baseEvent)) return fail("LEDGER_CHAIN_INVALID", { index });
        if (await digest({ ...baseEvent, sequence, previousHash }) !== hash) return fail("LEDGER_HASH_MISMATCH", { index });
        previous = hash;
      }
      if (previous !== copy.headHash) return fail("LEDGER_HEAD_MISMATCH");
      return { ok: true, revision: copy.revision, headHash: copy.headHash };
    } catch (error) {
      return fail("LEDGER_VERIFY_ERROR", { detail: error.message });
    }
  }

  async function appendAuditEvent(ledger, raw) {
    const verified = await verifyLedger(ledger);
    if (!verified.ok) return fail("LEDGER_NOT_VERIFIED", { cause: verified.error, index: verified.index });
    const normalized = normalizeEvent(raw, ledger);
    if (!normalized.ok) return normalized;
    const existing = ledger.events.find((event) => event.eventId === normalized.event.eventId);
    if (existing) {
      const { sequence, previousHash, hash, ...stored } = existing;
      const comparable = normalized.explicitTime ? normalized.event : { ...normalized.event, occurredAt: existing.occurredAt };
      if (canonical(stored) === canonical(comparable)) return { ok: true, duplicate: true, ledger };
      return fail("EVENT_ID_CONFLICT");
    }
    if (ledger.events.length >= MAX_EVENTS) return fail("LEDGER_LIMIT_REACHED");
    const payload = { ...normalized.event, sequence: ledger.revision + 1, previousHash: ledger.headHash };
    let hash;
    try {
      hash = await digest(payload);
    } catch (error) {
      return fail("AUDIT_HASH_ERROR", { detail: error.message });
    }
    const event = freeze({ ...payload, hash });
    const next = freeze({ ...ledger, revision: ledger.revision + 1, headHash: hash, events: [...ledger.events, event] });
    return { ok: true, duplicate: false, event, ledger: next };
  }

  function exportProof(ledger) {
    return { schemaVersion: ledger.schemaVersion, environment: ledger.environment, tenantId: ledger.tenantId, revision: ledger.revision, headHash: ledger.headHash, events: ledger.events };
  }

  return Object.freeze({ GENESIS, createLedger, appendAuditEvent, verifyLedger, exportProof, canonical });
});
