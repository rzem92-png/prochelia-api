import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function createOperationalCase");
const end = source.indexOf("\\n\\nasync function getTableColumns", start);
const body = source.slice(start, end);

test("client cases derive client identity from authenticated profile and verify mission ownership", () => {
  assert.match(body, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(body, /mission\.client_id !== clientId/);
  assert.doesNotMatch(body, /clean\(body\.client_id\)/);
});

test("intervenant cases derive profile and verify assigned mission", () => {
  assert.match(body, /SELECT id FROM intervenants WHERE user_id=\?/);
  assert.match(body, /mission\.intervenant_id !== intervenantId/);
  assert.doesNotMatch(body, /clean\(body\.intervenant_id\)/);
});

test("company cases derive active company profile and reject unverified mission scope", () => {
  assert.match(body, /business_profiles WHERE owner_user_id=\?/);
  assert.match(body, /BUSINESS_MISSION_SCOPE_NOT_CONFIGURED/);
  assert.doesNotMatch(body, /clean\(body\.company_id\)/);
});
