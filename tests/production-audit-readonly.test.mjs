import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

function bodyOf(name, nextMarker) {
  const start = source.indexOf(name);
  assert.notEqual(start, -1, `missing function: ${name}`);
  const end = source.indexOf(nextMarker, start);
  assert.notEqual(end, -1, `missing end marker after: ${name}`);
  return source.slice(start, end);
}

test("productionConfigCheck is read-only by default", () => {
  const body = bodyOf("async function productionConfigCheck(env)", "async function finalProductionAudit");
  assert.doesNotMatch(body, /ensure[A-Za-z0-9_]*Schema\s*\(/);
  assert.doesNotMatch(body, /\.prepare\s*\(\s*`\s*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i);
  assert.doesNotMatch(body, /registerIntegration\s*\(/);
});

test("strict production audit performs no persistence or journal writes", () => {
  const body = bodyOf("async function strictProductionAudit(request,env)", "const __procheliaProductionSafetyHandle");
  assert.doesNotMatch(body, /\.prepare\s*\(/);
  assert.doesNotMatch(body, /\bjournal\s*\(/);
  assert.doesNotMatch(body, /ensure[A-Za-z0-9_]*Schema\s*\(/);
});

test("payment webhook atomicity is an explicit blocking readiness gate", () => {
  const body = bodyOf("async function strictProductionAudit(request,env)", "const __procheliaProductionSafetyHandle");
  assert.match(body, /PAYMENT_WEBHOOK_ATOMICITY/);
  assert.match(body, /PAYMENT_WEBHOOK_DISABLED_PENDING_REVIEW/);
  assert.match(body, /ready_for_real_traffic:false/);
  assert.match(body, /real_traffic_authorized:false/);
  assert.match(body, /blockingCodes=new Set\(\['PAYMENT_WEBHOOK_ATOMICITY'/);
});

test("production audit endpoints reject GET and require explicit POST", () => {
  const body = bodyOf("const __procheliaProductionSafetyHandle", "// Browser session transport");
  assert.match(body, /preflightMethod !== 'POST'/);
  assert.match(body, /'allow':'POST'/);
  assert.match(body, /return strictProductionAudit\(request,env\)/);
});
