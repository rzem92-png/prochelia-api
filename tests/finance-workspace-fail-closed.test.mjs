import test from "node:test";
import assert from "node:assert/strict";
import {
  financeDashboard,
  financeExport,
  financeEntryCreate,
  financeProblemCreate,
  financeProblemResolve
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
