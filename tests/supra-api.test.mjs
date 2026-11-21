import test from "node:test";
import assert from "node:assert/strict";
import { handleSupraRoute } from "../src/supra-api.js";

function makeDb() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) { return { run: async () => { calls.push({ sql, values }); return { success: true }; } }; },
        run: async () => { calls.push({ sql, values: [] }); return { success: true }; }
      };
    }
  };
}
const manager = { user: { id: "manager-1", role: "GERANTE", tenant_id: "tenant-preview", tenant_role: "OWNER" } };
const client = { user: { id: "client-1", role: "CLIENT" } };

test("SUPRA route ignores unrelated paths", async () => {
  assert.equal(await handleSupraRoute(new Request("https://example.test/api/unknown"), { DB: makeDb() }, manager), null);
});

test("SUPRA route rejects anonymous and non-manager callers before D1 writes", async () => {
  for (const auth of [null, client]) {
    const DB = makeDb();
    const response = await handleSupraRoute(new Request("https://example.test/api/supra/plan", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({})
    }), { DB }, auth);
    assert.equal(response.status, auth ? 403 : 401);
    assert.equal(DB.calls.length, 0);
  }
});

test("SUPRA plan is audited and never executes", async () => {
  const DB = makeDb();
  const response = await handleSupraRoute(new Request("https://example.test/api/supra/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      caseType: "remboursement", requestedAction: "REFUND", impact: "LOW",
      context: { mission_id: "m-1", pspConfirmed: true }
    })
  }), { DB }, manager);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.executionAllowed, false);
  assert.equal(payload.plan.executionAllowed, false);
  assert.equal(payload.decision.executionAllowed, false);
  assert.equal(payload.audit.recorded, true);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.ok(payload.plan.missingEvidence.includes("verify_psp_event_and_ledger"));
  assert.equal(DB.calls.length, 1);
  assert.match(DB.calls[0].sql, /INSERT INTO supra_audit_events/);
  assert.doesNotMatch(DB.calls[0].sql, /CREATE TABLE/);
});

test("SUPRA route rejects invalid JSON and non-JSON content types", async () => {
  const DB = makeDb();
  const wrongType = await handleSupraRoute(new Request("https://example.test/api/supra/plan", {
    method: "POST", headers: { "content-type": "text/plain" }, body: "{}"
  }), { DB }, manager);
  assert.equal(wrongType.status, 415);
  const invalid = await handleSupraRoute(new Request("https://example.test/api/supra/plan", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{"
  }), { DB }, manager);
  assert.equal(invalid.status, 400);
  assert.equal(DB.calls.length, 0);
});

test("SUPRA domains endpoint is authenticated and read-only", async () => {
  const DB = makeDb();
  const response = await handleSupraRoute(new Request("https://example.test/api/supra/domains"), { DB }, manager);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.ok(payload.domains.length >= 20);
  assert.equal(DB.calls.length, 0);
});

test("SUPRA route fails closed if audit persistence is unavailable", async () => {
  const response = await handleSupraRoute(new Request("https://example.test/api/supra/plan", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ caseType: "routine", requestedAction: "GENERATE_SUMMARY", impact: "LOW" })
  }), { DB: { prepare() { throw new Error("offline"); } } }, manager);
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.executionAllowed, false);
});

test("persisted approval request is reachable through the main Nexus router", async () => {
  const statements = [];
  const DB = {
    prepare(sql) {
      return {
        sql, values: [],
        bind(...values) { this.values = values; return this; }
      };
    },
    async batch(items) {
      statements.push(...items.map(item => ({ sql: item.sql, values: item.values })));
      return items.map(() => ({ meta: { changes: 1 } }));
    }
  };
  const response = await handleSupraRoute(new Request("https://example.test/api/supra/approvals/request", {
    method: "POST",
    headers: { origin: "https://example.test", "content-type": "application/json" },
    body: JSON.stringify({
      action: "PRODUCTION_RELEASE",
      tenantId: "tenant-preview",
      resourceId: "release-candidate",
      payload: { commit: "abc123", target: "preview" },
      reason: "Independent release gate"
    })
  }), { DB }, manager);
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.request.requiredApprovals, 2);
  assert.ok(statements.some(item => item.sql.includes("INSERT INTO supra_approval_requests")));
});


test("SUPRA fail-closed input is rejected with 422 and audited as rejected, never as a prepared plan", async () => {
  const DB = makeDb();
  const response = await handleSupraRoute(new Request("https://example.test/api/supra/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      case_type: "paiement",
      action: "REFUND",
      impact: "HIGH",
      market: "fr"
    })
  }), { DB }, manager);
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "SUPRA_INPUT_REJECTED");
  assert.equal(payload.plan.rejectionReason, "UNEXPECTED_INPUT_FIELD");
  assert.equal(payload.decision.risk, "HIGH");
  assert.equal(payload.decision.managerApprovalRequired, true);
  assert.equal(payload.executionAllowed, false);
  assert.equal(payload.audit.recorded, true);
  assert.equal(DB.calls.length, 1);
  assert.match(DB.calls[0].sql, /INSERT INTO supra_audit_events/);
  assert.equal(DB.calls[0].values[1], "tenant-preview");
  assert.equal(DB.calls[0].values[4], "PLAN_INPUT_REJECTED");
  assert.equal(DB.calls[0].values[5], "securite");
  assert.equal(DB.calls[0].values[6], "INVALID_INPUT");
  assert.equal(DB.calls[0].values[7], "HIGH");
  assert.equal(DB.calls[0].values[8], 1);
});


test("SUPRA plan rejects oversized payload while streaming before audit write", async () => {
  const DB = makeDb();
  const response = await handleSupraRoute(new Request("https://example.test/api/supra/plan", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ caseType: "routine", requestedAction: "GENERATE_SUMMARY", impact: "LOW", context: { problem_statement: "x".repeat(17000) } })
  }), { DB }, manager);
  assert.equal(response.status, 413);
  assert.equal(DB.calls.length, 0);
});

test("SUPRA plan does not claim audit persistence when D1 reports success false", async () => {
  const DB = { prepare() { return { bind() { return { run: async () => ({ success: false }) }; } }; } };
  const response = await handleSupraRoute(new Request("https://example.test/api/supra/plan", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ caseType: "routine", requestedAction: "GENERATE_SUMMARY", impact: "LOW" })
  }), { DB }, manager);
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.executionAllowed, false);
  assert.equal(payload.audit?.recorded, undefined);
});


test("SUPRA audit write binds the server-derived tenant, never a client-selected tenant", async () => {
  const DB = makeDb();
  const response = await handleSupraRoute(new Request("https://example.test/api/supra/plan", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ caseType: "routine", requestedAction: "GENERATE_SUMMARY", impact: "LOW", tenant_id: "attacker-tenant" })
  }), { DB }, manager);
  assert.equal(response.status, 422);
  assert.equal(DB.calls.length, 1);
  assert.match(DB.calls[0].sql, /tenant_id/);
  assert.equal(DB.calls[0].values[1], "tenant-preview");
});


test("SUPRA rejects a global manager who lacks an administrative role in the active tenant", async () => {
  const DB = makeDb();
  const auth = { user: { id: "manager-2", role: "GERANTE", tenant_id: "tenant-preview", tenant_role: "READ_ONLY" } };
  const response = await handleSupraRoute(new Request("https://example.test/api/supra/domains"), { DB }, auth);
  assert.equal(response.status, 403);
  assert.equal(DB.calls.length, 0);
});

test("SUPRA rejects an administrative global role without an active tenant membership role", async () => {
  const DB = makeDb();
  const auth = { user: { id: "manager-3", role: "GERANTE", tenant_id: "tenant-preview" } };
  const response = await handleSupraRoute(new Request("https://example.test/api/supra/domains"), { DB }, auth);
  assert.equal(response.status, 403);
  assert.equal(DB.calls.length, 0);
});
