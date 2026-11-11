import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function createOperationalCase(");
const end = source.indexOf("\n\nasync function getTableColumns(", start);
const handler = source.slice(start, end);

test("operational case creation is authenticated and denies company role without membership mapping", () => {
  assert.match(handler, /requireAuthRole\(request,env,\['gerante','client','intervenant'\]\)/);
  assert.doesNotMatch(handler, /'entreprise'/);
  assert.match(handler, /readJsonLimited\(request,16384\)/);
});

test("client and provider cases derive profile IDs from the authenticated session", () => {
  assert.match(handler, /SELECT id FROM clients WHERE user_id=\? LIMIT 1/);
  assert.match(handler, /SELECT id FROM intervenants WHERE user_id=\? LIMIT 1/);
  assert.match(handler, /mission\.client_id!==clientId/);
  assert.match(handler, /mission\.intervenant_id!==intervenantId/);
  assert.match(handler, /missionId=mission\.id; clientId=mission\.client_id; intervenantId=mission\.intervenant_id/);
  assert.doesNotMatch(handler, /clean\(body\.client_id\)|clean\(body\.intervenant_id\)|clean\(body\.company_id\)/);
});

test("non-manager reports cannot trigger automatic execution or forged downstream actions", () => {
  assert.match(handler, /if\(role!=='gerante'\)\s*\{\s*rec\.action='ANALYZE_AND_PROPOSE'/);
  assert.match(handler, /rec\.mode='MANAGER_APPROVAL'/);
  assert.match(handler, /steps:\['qualify','verify_ownership','manager_review','audit'\]/);
  assert.match(handler, /journal\(env,role,gate\.auth\.user\.id,'CASE_CREATED'/);
});
