import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("all support/system authorization helpers reference the real session resolver", () => {
  assert.equal(/\bgetAuth\s*\(/.test(source), false, "undefined getAuth() calls must not remain");
  assert.match(source, /async function supportAuth\(request,env\)[\s\S]*?getSessionUser\(request,env\)/);
});

test("system scale and backup routes require a manager session", () => {
  const routes = source.slice(source.indexOf("const __procheliaNationalHandle = handle"));
  assert.equal((routes.match(/getSessionUser\(request,env\)/g) || []).length >= 3, true);
  assert.match(routes, /auth\.user\|\|String\(auth\.user\.role\|\|''\)\.toUpperCase\(\)!=='GERANTE'/);
});

test("all payment handlers are wired into the active base router with explicit methods", () => {
  const router = source.slice(source.indexOf("async function handleBase(request, env)"));
  const routes = [
    ["/api/payments/onboard", "POST", "paymentOnboard"],
    ["/api/payments/status", "GET", "paymentStatus"],
    ["/api/payments/mission/create", "POST", "createMissionPayment"],
    ["/api/payments/mission/finalize", "POST", "finalizeMissionPayment"],
    ["/api/payments/payout", "POST", "payoutRequest"],
    ["/api/payments/webhook", "POST", "paymentWebhook"],
    ["/api/payments/dispute", "POST", "openPaymentDispute"],
    ["/api/payments/dispute/resolve", "POST", "paymentAdminResolve"]
  ];
  for (const [path, method, handler] of routes) {
    assert.match(router, new RegExp("'" + path.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") + "': \\['" + method + "', " + handler + "\\]"));
  }
});
