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
const manager = { user: { id: "manager-1", role: "gerante" } };
const client = { user: { id: "client-1", role: "client" } };

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
  assert.ok(payload.plan.missingEvidence.includes("verify_psp_event_and_ledger"));
  assert.equal(DB.calls.length, 2);
  assert.match(DB.calls[0].sql, /CREATE TABLE IF NOT EXISTS supra_audit_events/);
  assert.match(DB.calls[1].sql, /INSERT INTO supra_audit_events/);
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
