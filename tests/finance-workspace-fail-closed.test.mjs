import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  financeDashboard,
  financeExport,
  financeEntryCreate,
  financeProblemCreate,
  financeProblemResolve,
  handleConsolidated
} from "../src/index.js";

function managerEnv() {
  const statements = [];
  const writes = [];
  const env = {
    DB: {
      prepare(sql) {
        statements.push(sql);
        return {
          bind() {
            return {
              async first() {
                assert.match(sql, /FROM sessions s/);
                return {
                  id: "manager-1",
                  role: "gerante",
                  email: "manager@example.test",
                  first_name: "Synthetic",
                  last_name: "Manager",
                  phone: null,
                  status: "active",
                  created_at: "2026-11-18 00:00:00",
                  updated_at: "2026-11-18 00:00:00",
                  session_id: "synthetic-session-1"
                };
              },
              async run() {
                writes.push(sql);
                throw new Error("Unexpected finance write");
              },
              async all() {
                throw new Error("Unexpected finance read");
              }
            };
          },
          async run() {
            writes.push(sql);
            throw new Error("Unexpected finance write");
          }
        };
      }
    }
  };
  return { env, statements, writes };
}

function managerRequest(path, method = "GET", body = null) {
  const headers = { cookie: "prochelia_session=synthetic-session-token" };
  const init = { method, headers };
  if (body !== null) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return new Request("https://api.example.test" + path, init);
}

test("finance workspace endpoints fail closed before schema DDL, business reads, exports or writes", async () => {
  const routes = [
    [financeDashboard, "/api/finance/dashboard", "GET", null],
    [financeExport, "/api/finance/export?format=csv", "GET", null],
    [financeEntryCreate, "/api/finance/entry", "POST", { amount_eur: 100, entry_type: "expense" }],
    [financeProblemCreate, "/api/finance/problem", "POST", { issue_type: "ACCOUNTING_MISMATCH", amount_cents: 10000 }],
    [financeProblemResolve, "/api/finance/problem/resolve", "POST", { case_id: "synthetic-case-1", approve: true }]
  ];
  for (const [handler, path, method, body] of routes) {
    const { env, statements, writes } = managerEnv();
    const response = await handler(managerRequest(path, method, body), env);
    assert.equal(response.status, 503, path);
    assert.equal((await response.json()).error, "TENANT_SCOPED_FINANCE_NOT_READY", path);
    assert.equal(statements.length, 1, "only the authenticated session lookup is permitted: " + path);
    assert.match(statements[0], /FROM sessions s/);
    assert.equal(writes.length, 0, "no finance data may be written: " + path);
  }
});

test("operations dashboard does not present the legacy single-line ledger as a finance KPI", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function getOperationsDashboard");
  const end = source.indexOf("\nasync function getJournal", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /accounting_ledger/);
  assert.match(body, /finance_status = 'TENANT_SCOPED_FINANCE_NOT_READY'/);
  assert.match(body, /ledger_balance = null/);
  assert.match(body, /proposal_only_fail_closed_pending_tenant_ownership/);
});


test("consolidated routes that are deliberately disabled return 503 without runtime schema DDL", async () => {
  const routes = [
    ["/api/finance/summary", "GET", null, "TENANT_SCOPED_FINANCE_NOT_READY"],
    ["/api/pricing/quote", "POST", { service_code: "SYNTHETIC" }, "SERVER_PRICING_POLICY_NOT_READY"],
    ["/api/cases", "POST", { client_id: "synthetic-client" }, "TENANT_SCOPED_CASE_CREATION_NOT_IMPLEMENTED"],
    ["/api/cases/approve", "POST", { case_id: "synthetic-case" }, "TENANT_SCOPED_APPROVAL_NOT_IMPLEMENTED"],
    ["/api/complaints", "POST", { client_id: "synthetic-client" }, "TENANT_SCOPED_COMPLAINTS_NOT_READY"]
  ];

  for (const [path, method, body, expectedError] of routes) {
    const { env, statements, writes } = managerEnv();
    const response = await handleConsolidated(managerRequest(path, method, body), env);
    assert.equal(response.status, 503, path);
    assert.equal((await response.json()).error, expectedError, path);
    assert.equal(statements.length, 1, "only the authenticated session lookup is permitted: " + path);
    assert.match(statements[0], /FROM sessions s/);
    assert.equal(writes.length, 0, "no schema or business write may occur: " + path);
  }
});
