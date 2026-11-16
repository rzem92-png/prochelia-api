import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const v7 = await readFile(new URL("../src/v7.js", import.meta.url), "utf8");

test("SUPRA domain and plan routes are registered on the consolidated API", () => {
  assert.match(source, /\/api\/supra\/domains/);
  assert.match(source, /\/api\/supra\/plan/);
  assert.match(source, /async function supraDomains\(request, env\)/);
  assert.match(source, /async function supraPlan\(request, env\)/);
});

test("SUPRA endpoints require an authenticated manager and bounded request input", () => {
  assert.match(source, /async function supraDomains\(request, env\)\s*\{\s*const gate=await requireAuthRole\(request,env,\['gerante'\]\)/);
  assert.match(source, /async function supraPlan\(request, env\)\s*\{\s*\/\/[\s\S]*?const gate=await requireAuthRole\(request,env,\['gerante'\]\)/);
  assert.match(source, /readBoundedRequestBody\(request,16384\)/);
  assert.match(source, /CLIENT_SUPPLIED_EVIDENCE_NOT_TRUSTED/);
  assert.match(source, /executionAllowed:false/);
  assert.match(source, /SUPRA_PLAN_GENERATED/);
  assert.match(source, /await journal\(env,\'gerante\',gate\.auth\.user\.id/);
  assert.match(source, /\/api\/supra\/plan/);
});

test("SUPRA plan route does not run schema DDL before authorization", () => {
  const start = source.indexOf("async function supraPlan");
  const end = source.indexOf("\nconst __procheliaProductionSafetyHandle", start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  assert.ok(body.indexOf("requireAuthRole") < body.indexOf("readBoundedRequestBody"));
  assert.doesNotMatch(body, /ensureConsolidatedSchema|CREATE TABLE/);
});

test("V7 exports only the deterministic SUPRA governance surface", () => {
  for (const name of ["assessSupraDecision","simulateResilience","buildSupraPlan","getSupraDomainRegistry"]) {
    assert.match(v7, new RegExp("\\b" + name + "\\b"));
  }
});

test("free-text problem statement is excluded from the narrower evidence governance context", () => {
  assert.match(source, /const governanceContext = \{\};/);
  assert.match(source, /actorRole:gate\.auth\.user\.role,context:governanceContext/);
  assert.doesNotMatch(source, /actorRole:gate\.auth\.user\.role,context\s*\}/);
});
