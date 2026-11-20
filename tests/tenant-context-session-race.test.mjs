import test from "node:test";
import assert from "node:assert/strict";
import { resolveTenantContext } from "../src/tenant-context.js";

test("active tenant resolution rechecks the exact tenant captured by session authentication", async () => {
  let sql = "";
  let params = [];
  const DB = {
    prepare(statement) {
      sql = statement;
      return { bind(...values) {
        params = values;
        return { async first() {
          return {
            tenant_id: "tenant-a", tenant_slug: "tenant-a", tenant_name: "Tenant A",
            membership_id: "membership-a", membership_role: "OWNER"
          };
        }};
      }};
    }
  };
  const auth = { user: { id: "user-a" }, session_id: "session-a", session_active_tenant_id: "tenant-a" };
  const result = await resolveTenantContext(new Request("https://api.example.test/"), { DB }, auth);
  assert.equal(result.ok, true);
  assert.ok(sql.includes("AND s.active_tenant_id = ?"));
  assert.deepEqual(params, ["session-a", "user-a", "tenant-a"]);
});

test("no-selection resolution requires the session to remain unselected at query time", async () => {
  let sql = "";
  let params = [];
  const DB = {
    prepare(statement) {
      sql = statement;
      return { bind(...values) {
        params = values;
        return { async all() {
          return { success: true, results: [{
            tenant_id: "tenant-a", tenant_slug: "tenant-a", tenant_name: "Tenant A",
            membership_id: "membership-a", membership_role: "OWNER"
          }]};
        }};
      }};
    }
  };
  const auth = { user: { id: "user-a" }, session_id: "session-a", session_active_tenant_id: null };
  const result = await resolveTenantContext(new Request("https://api.example.test/"), { DB }, auth);
  assert.equal(result.ok, true);
  assert.ok(sql.includes("AND s.active_tenant_id IS NULL"));
  assert.deepEqual(params, ["session-a", "user-a"]);
});
