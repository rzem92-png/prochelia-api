import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

function section(start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing source marker: ${start}`);
  const to = source.indexOf(end, from);
  assert.notEqual(to, -1, `missing source end marker: ${end}`);
  return source.slice(from, to);
}

test("production audit can never authorize real traffic", () => {
  const audit = section("async function strictProductionAudit", "const __procheliaProductionSafetyHandle");
  assert.match(audit, /PAYMENT_WEBHOOK_ATOMICITY/);
  assert.match(audit, /PAYMENT_WEBHOOK_DISABLED_PENDING_REVIEW/);
  assert.match(audit, /real_traffic_authorized:false/);
  assert.match(audit, /ready_for_real_traffic:false/);
  assert.doesNotMatch(audit, /ready_for_real_traffic:configurationReady/);
});

test("user-facing exception handlers do not disclose internal exception messages", () => {
  assert.match(source, /error:'NATIONAL_CONTINUITY_ERROR'\},500\)/);
  assert.match(source, /error:'MASTER_COMPLEMENT_ERROR',version:VERSION\},500\)/);
  assert.doesNotMatch(source, /error:'NATIONAL_CONTINUITY_ERROR',message:String\(e\.message/);
  assert.doesNotMatch(source, /error:'MASTER_COMPLEMENT_ERROR',version:VERSION,message:String\(e\.message/);
});

test("malformed percent-encoded session cookie is rejected safely", () => {
  const cookie = section("function getCookie(request, name)", "function sessionCookie");
  assert.match(cookie, /try \{ return decodeURIComponent/);
  assert.match(cookie, /catch \{ return null; \}/);
});
