import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function complaintCreate");
const end = source.indexOf("async function setPhase", start);
assert.ok(start >= 0 && end > start, "complaintCreate must remain present");
const handler = source.slice(start, end);

test("complaint creation enforces client ownership of linked missions", () => {
  assert.match(handler, /FROM missions m\s+JOIN clients c ON c\.id=m\.client_id/i);
  assert.match(handler, /mission\.client_user_id!==gate\.auth\.user\.id/);
  assert.match(handler, /MISSION_NOT_FOUND/);
});

test("complaint relationships are canonical and not copied from arbitrary browser fields", () => {
  assert.match(handler, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(handler, /SELECT id FROM clients WHERE id=\?/);
  assert.doesNotMatch(handler, /b\.company_id|b\.client_type/);
  assert.match(handler, /\.bind\(id,'B2C',clientId,null,missionId\|\|null/);
});

test("complaint inputs are bounded and client severity is not trusted", () => {
  assert.match(handler, /description\.length>2000/);
  assert.match(handler, /category\.length>80/);
  assert.match(handler, /role==='gerante'\?requestedSeverity:'LOW'/);
  assert.match(handler, /context:\{summary:category,details:description\}/);
});
