import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const routesSource = readFileSync(new URL("../src/v7-routes.js", import.meta.url), "utf8");

test("sensitive operational routes require an authenticated gerante before dispatch", () => {
  const handleStart = indexSource.indexOf("async function handle(request,env)");
  assert.notEqual(handleStart, -1);
  const handleEnd = indexSource.indexOf("\nexport default", handleStart);
  assert.notEqual(handleEnd, -1);
  const handler = indexSource.slice(handleStart, handleEnd);
  const guard = handler.indexOf("const adminOnlyPaths = new Set([");
  const firstDispatch = handler.indexOf("const fw=await handleFinanceWorkspace");
  assert.ok(guard >= 0 && firstDispatch > guard, "admin gate must run before route dispatch");
  for (const path of [
    "/api/ops/case/execute", "/api/ops/outbox/process", "/api/copilot/briefing",
    "/api/clients/score", "/api/loyalty/update", "/api/quality",
    "/api/capacity/dashboard", "/api/finance/forecast", "/api/system/audit",
    "/api/system/final-audit", "/api/system/production-check",
    "/api/copilot/next-actions", "/api/jobs/process", "/api/ops/dashboard",
    "/api/journal", "/api/cases/approve", "/api/metiers/suggest",
    "/api/settings/phase"
  ]) assert.ok(handler.includes(path), `missing admin gate for ${path}`);
  assert.match(handler, /routeAuth\.user\.role !== 'gerante'/);
  assert.match(handler, /url\.pathname\.startsWith\('\/api\/finance\/'\)/);
  assert.match(handler, /url\.pathname\.startsWith\('\/api\/strategic\/'\)/);
  assert.match(handler, /url\.pathname\.startsWith\('\/api\/ops\/'\)/);
  assert.match(handler, /error: 'UNAUTHENTICATED'/);
  assert.match(handler, /error: 'FORBIDDEN'/);
});

test("V7 route failures never disclose internal exception messages", () => {
  assert.match(routesSource, /error: "INTERNAL_ERROR"/);
  assert.doesNotMatch(routesSource, /error:\s*error\?\.message/);
});
