import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const base = "https://prochelia-api.test";

function readinessEnv({ database = true, missions = true, users = true } = {}) {
  const DB = {
    prepare(sql) {
      return {
        async first() {
          if (sql.includes("SELECT 1 AS ok")) return database ? { ok: 1 } : null;
          if (sql.includes("name='missions'")) return missions ? { sql: "CREATE TABLE missions (...)" } : null;
          if (sql.includes("name='users'")) return users ? { sql: "CREATE TABLE users (...)" } : null;
          return null;
        }
      };
    }
  };
  return { DB };
}

test("readiness distinguishes database infrastructure from marketplace production readiness", async () => {
  const response = await worker.fetch(new Request(base + "/api/readiness"), readinessEnv());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true, "infra API can be reachable");
  assert.equal(body.infrastructure_ready, true);
  assert.equal(body.platform_ready, false);
  assert.equal(body.ready, false, "do not advertise production-ready while business gates are closed");
  assert.equal(body.status, "preproduction_blocked");
  assert.equal(body.writes, false);
  assert.equal(body.payments_enabled, false);
  assert.ok(body.blockers.includes("mission_workflow"));
  assert.ok(body.blockers.includes("server_pricing"));
  assert.ok(body.blockers.includes("refund_ledger"));
  assert.ok(body.blockers.includes("psp_reconciliation"));
  assert.equal(Object.values(body.feature_gates).every(value => value === false), true);
});

test("readiness fails closed when required D1 schema is unavailable", async () => {
  const response = await worker.fetch(new Request(base + "/api/readiness"), readinessEnv({ users: false }));
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.ok, false);
  assert.equal(body.ready, false);
  assert.equal(body.infrastructure_ready, false);
});
