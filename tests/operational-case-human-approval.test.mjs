import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function createOperationalCase");
const end = source.indexOf("async function getTableColumns", start);
assert.ok(start >= 0 && end > start, "createOperationalCase must remain present");
const handler = source.slice(start, end);

test("user-submitted operational cases always require manager approval", () => {
  assert.match(handler, /rec\.action='ANALYZE_AND_PROPOSE'/);
  assert.match(handler, /rec\.mode='MANAGER_APPROVAL'/);
  assert.match(handler, /const requiresManager=1/);
  assert.match(handler, /const status='OPEN'/);
  assert.doesNotMatch(handler, /executeOperationalCase\(env,id,null,true\)/);
});

test("operational case mission IDs are checked against the authenticated owner", () => {
  assert.match(handler, /FROM missions m\s+JOIN clients c ON c\.id=m\.client_id\s+LEFT JOIN intervenants i ON i\.id=m\.intervenant_id/i);
  assert.match(handler, /mission\.client_user_id!==gate\.auth\.user\.id/);
  assert.match(handler, /mission\.intervenant_user_id!==gate\.auth\.user\.id/);
  assert.doesNotMatch(handler, /clean\(body\.client_id\)|clean\(body\.company_id\)|clean\(body\.intervenant_id\)/);
});

test("untrusted operational context is reduced to report fields only", () => {
  assert.match(handler, /summary:typeof rawContext\.summary/);
  assert.match(handler, /details:typeof rawContext\.details/);
  assert.match(handler, /observed_at:typeof rawContext\.observed_at/);
  assert.doesNotMatch(handler, /rawContext\.replacement_intervenant_id|rawContext\.replacement_id|rawContext\.reschedule_start_at|rawContext\.client_notification/);
  assert.match(handler, /JSON\.stringify\(reportContext\)/);
});

test("business and enterprise roles cannot use the unverified company path", () => {
  assert.match(handler, /requireAuthRole\(request,env,\['gerante','client','intervenant'\]\)/);
});
