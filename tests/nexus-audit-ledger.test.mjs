import test from "node:test";
import assert from "node:assert/strict";
import "../src/nexus-audit-ledger.js";

const api = globalThis.ProcheliaNexusAuditLedger;
const { createLedger, appendAuditEvent, verifyLedger, exportProof } = api;
const base = {
  eventId: "evt-001", actorId: "nexus-agent", actorType: "AGENT",
  eventType: "TASK_PLANNED", domain: "OPS", action: "PLAN_TASK",
  risk: "LOW", approvalRequired: false, executionAllowed: false,
  environment: "preview", tenantId: "tenant-a", correlationId: "corr-001",
  taskId: "task-001", agentId: "ops-agent", toolId: "github-read",
  policyVersion: "policy-v1", actionHash: "a".repeat(64), approvalIds: [],
  evidenceRefs: ["commit-001"], outcome: "OBSERVED",
  occurredAt: "2026-11-27T10:00:00.000Z",
  details: { branch: "preview/feature", attempt: 1 },
};
function ledger() {
  const result = createLedger({ environment: "preview", tenantId: "tenant-a" });
  assert.equal(result.ok, true);
  return result.ledger;
}
async function add(current, event = base) {
  const result = await appendAuditEvent(current, event);
  assert.equal(result.ok, true, result.error);
  return result.ledger;
}

test("creates Preview-only tenant ledger with zero-hash genesis", () => {
  const current = ledger();
  assert.equal(current.revision, 0);
  assert.equal(current.headHash, api.GENESIS);
  assert.deepEqual(current.events, []);
  assert.ok(Object.isFrozen(current));
  assert.equal(createLedger({ environment: "production" }).error, "ENVIRONMENT_DENIED");
});

test("hashes events and verifies a two-entry append-only chain", async () => {
  const current = await add(await add(ledger()), {
    ...base, eventId: "evt-002", eventType: "TASK_VERIFIED",
    occurredAt: "2026-11-27T10:00:01.000Z", outcome: "VERIFIED", resultHash: "b".repeat(64),
  });
  assert.equal(current.revision, 2);
  assert.equal(current.events[0].sequence, 1);
  assert.equal(current.events[1].sequence, 2);
  assert.equal(current.events[1].previousHash, current.events[0].hash);
  assert.notEqual(current.headHash, api.GENESIS);
  assert.equal((await verifyLedger(current)).ok, true);
});

test("identical event id replay is idempotent and changed content conflicts", async () => {
  const current = await add(ledger());
  const duplicate = await appendAuditEvent(current, base);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.ledger.revision, 1);
  assert.equal((await appendAuditEvent(current, { ...base, action: "DELETE" })).error, "EVENT_ID_CONFLICT");
});

test("idempotent replay also works when occurredAt is server-generated", async () => {
  const event = { ...base, eventId: "evt-auto-time" };
  delete event.occurredAt;
  const current = await add(ledger(), event);
  const replay = await appendAuditEvent(current, event);
  assert.equal(replay.ok, true);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.ledger.revision, 1);
});

test("detects event tampering, reordered entries and head tampering", async () => {
  const current = await add(await add(ledger()), { ...base, eventId: "evt-002", occurredAt: "2026-11-27T10:00:01.000Z" });
  const tampered = { ...current, events: current.events.map((event, i) => i === 0 ? { ...event, action: "TAMPERED" } : event) };
  assert.equal((await verifyLedger(tampered)).error, "LEDGER_HASH_MISMATCH");
  assert.equal((await verifyLedger({ ...current, events: [...current.events].reverse() })).error, "LEDGER_CHAIN_INVALID");
  assert.equal((await verifyLedger({ ...current, headHash: "c".repeat(64) })).error, "LEDGER_HEAD_MISMATCH");

  const invalid = { ...current, events: current.events.map((event, i) => i === 0 ? { ...event, risk: "INVALID" } : event) };
  const first = invalid.events[0];
  const { hash, ...payload } = first;
  first.hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(api.canonical(payload)))), (byte) => byte.toString(16).padStart(2, "0")).join("");
  invalid.headHash = invalid.events.at(-1).hash;
  assert.equal((await verifyLedger(invalid)).error, "LEDGER_CHAIN_INVALID");
});

test("rejects tenant and environment mixing", async () => {
  assert.equal((await appendAuditEvent(ledger(), { ...base, tenantId: "tenant-b" })).error, "EVENT_SCHEMA_INVALID");
  assert.equal((await appendAuditEvent(ledger(), { ...base, environment: "test" })).error, "EVENT_SCHEMA_INVALID");
  const otherTenant = createLedger({ environment: "preview", tenantId: "tenant-b" }).ledger;
  assert.equal((await appendAuditEvent(otherTenant, base)).error, "EVENT_SCHEMA_INVALID");
});

test("validates actor, enums, action hash and explicit approval IDs", async () => {
  for (const bad of [{ actorType: "ROOT" }, { risk: "EXTREME" }, { actionHash: "bad" }, { approvalRequired: 1 }, { approvalIds: ["bad id"] }, { outcome: "UNKNOWN" }, { eventId: "has spaces" }]) {
    const error = (await appendAuditEvent(ledger(), { ...base, ...bad })).error;
    assert.equal(error, bad.approvalIds ? "APPROVAL_IDS_INVALID" : "EVENT_SCHEMA_INVALID");
  }
});

test("rejects any claim of execution and records the non-executing guard", async () => {
  assert.equal((await appendAuditEvent(ledger(), { ...base, executionAllowed: true })).error, "EVENT_SCHEMA_INVALID");
  const result = await appendAuditEvent(ledger(), { ...base, executionAllowed: false });
  assert.equal(result.ok, true);
  assert.equal(result.event.executionAllowed, false);
  assert.equal((await appendAuditEvent(ledger(), { ...base, unknownField: "x" })).error, "EVENT_FIELD_UNKNOWN");
});

test("rejects secrets and unsafe/accessor/cyclic metadata", async () => {
  assert.equal((await appendAuditEvent(ledger(), { ...base, details: { accessToken: "secret" } })).error, "EVENT_INPUT_INVALID");
  const getter = {};
  Object.defineProperty(getter, "branch", { enumerable: true, get() { throw new Error("must not execute"); } });
  assert.equal((await appendAuditEvent(ledger(), { ...base, details: getter })).error, "EVENT_INPUT_INVALID");
  const cyclic = {};
  cyclic.loop = cyclic;
  assert.equal((await appendAuditEvent(ledger(), { ...base, details: cyclic })).error, "EVENT_INPUT_INVALID");
  assert.equal((await appendAuditEvent(ledger(), { ...base, details: { constructor: "unsafe" } })).error, "EVENT_INPUT_INVALID");
});

test("rejects timestamps outside the supported UTC range", async () => {
  assert.equal((await appendAuditEvent(ledger(), { ...base, occurredAt: Number.MAX_SAFE_INTEGER })).error, "EVENT_SCHEMA_INVALID");
});

test("bounds event metadata and event history", async () => {
  assert.equal((await appendAuditEvent(ledger(), { ...base, details: { payload: "x".repeat(7000) } })).error, "EVENT_TOO_LARGE");
  const oversized = { ...ledger(), events: Array(201).fill({}) };
  assert.equal((await verifyLedger(oversized)).error, "LEDGER_SCHEMA_INVALID");
});

test("proof export retains exact head and evidence references", async () => {
  const current = await add(ledger());
  const proof = exportProof(current);
  assert.equal(proof.headHash, current.headHash);
  assert.equal(proof.revision, 1);
  assert.deepEqual(proof.events, current.events);
});

test("unavailable cryptography fails closed", async () => {
  const original = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    assert.equal((await appendAuditEvent(ledger(), base)).error, "AUDIT_HASH_ERROR");
  } finally {
    Object.defineProperty(globalThis, "crypto", { value: original, configurable: true });
  }
});
