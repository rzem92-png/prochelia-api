import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function qualityCreate");
const end = source.indexOf("async function capacityDashboard", start);
assert.ok(start >= 0 && end > start, "qualityCreate must remain present");
const handler = source.slice(start, end);

test("quality event creation derives mission relationships from D1", () => {
  assert.match(handler, /FROM missions m\s+JOIN clients c ON c\.id=m\.client_id/i);
  assert.match(handler, /WHERE m\.id=\?/i);
  assert.match(handler, /mission\.client_id/);
  assert.match(handler, /mission\.intervenant_id/);
  assert.doesNotMatch(handler, /b\.client_id|b\.company_id|b\.intervenant_id/);
});

test("client quality event creation verifies mission ownership and hides cross-client existence", () => {
  assert.match(handler, /gate\.auth\.user\.role==='client'[\s\S]*?mission\.client_user_id!==gate\.auth\.user\.id/);
  assert.match(handler, /MISSION_NOT_FOUND/);
  assert.match(handler, /requireAuthRole\(request,env,\['gerante','client'\]\)/);
  assert.doesNotMatch(handler, /\['gerante','client','entreprise'\]/);
});

test("quality event inputs are bounded and clients cannot set internal severity", () => {
  assert.match(handler, /rating<1\|\|rating>5/);
  assert.match(handler, /comment\.length>2000/);
  assert.match(handler, /role==='gerante'\?requestedSeverity:'LOW'/);
  assert.match(handler, /actor_id:gate\.auth\.user\.id/);
});
