import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function qualityCreate(");
const end = source.indexOf("\nasync function capacityDashboard(", start);
const handler = source.slice(start, end);

test("quality feedback requires an authenticated supported role and bounded JSON", () => {
  assert.match(handler, /requireAuthRole\(request,env,\['gerante','client','intervenant'\]\)/);
  assert.doesNotMatch(handler, /'entreprise'/);
  assert.match(handler, /readJsonLimited\(request,8192\)/);
  assert.match(handler, /INVALID_RATING/);
  assert.match(handler, /INVALID_COMMENT/);
  assert.match(handler, /INVALID_SEVERITY/);
});

test("quality feedback verifies the mission belongs to the authenticated client or provider", () => {
  assert.match(handler, /SELECT id,client_id,intervenant_id FROM missions WHERE id=\? LIMIT 1/);
  assert.match(handler, /SELECT id FROM clients WHERE id=\? AND user_id=\? LIMIT 1/);
  assert.match(handler, /SELECT id FROM intervenants WHERE id=\? AND user_id=\? LIMIT 1/);
  assert.match(handler, /if\(!owner\)return json\(\{ok:false,error:'FORBIDDEN'/);
});

test("quality feedback persists relationship IDs from the verified mission, not caller-supplied IDs", () => {
  assert.match(handler, /\.bind\(id,mission\.id,mission\.client_id,null,mission\.intervenant_id/);
  assert.doesNotMatch(handler, /b\.client_id|b\.company_id|b\.intervenant_id/);
  assert.match(handler, /actor_user_id:gate\.auth\.user\.id/);
});
