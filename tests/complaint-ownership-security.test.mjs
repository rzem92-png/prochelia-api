import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function complaintCreate(");
const end = source.indexOf("\n\nasync function setPhase(", start);
const handler = source.slice(start, end);

test("complaint creation is authenticated, bounded and denies unsupported company membership", () => {
  assert.match(handler, /requireAuthRole\(request,env,\['gerante','client'\]\)/);
  assert.match(handler, /readJsonLimited\(request,8192\)/);
  assert.match(handler, /INVALID_SEVERITY/);
  assert.match(handler, /INVALID_DESCRIPTION/);
});

test("client complaints are bound to the authenticated client and mission", () => {
  assert.match(handler, /SELECT id FROM clients WHERE user_id=\? LIMIT 1/);
  assert.match(handler, /mission\.client_id!==clientId/);
  assert.match(handler, /mission\.id;clientId=mission\.client_id;intervenantId=mission\.intervenant_id/);
  assert.doesNotMatch(handler, /b\.client_id\|\|null|b\.company_id\|\|null|b\.mission_id\|\|null/);
});

test("failed linked case creation compensates by removing the orphan complaint", () => {
  assert.match(handler, /if\(!caseResponse\.ok \|\| !caseJson\.case_id\)/);
  assert.match(handler, /DELETE FROM complaints WHERE id=\?/);
});
