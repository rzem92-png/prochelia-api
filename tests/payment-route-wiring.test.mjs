import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const baseStart = source.indexOf("async function handleBase(request, env) {");
const baseEnd = source.indexOf("\n/* ============================================================", baseStart);
assert.ok(baseStart >= 0 && baseEnd > baseStart, "canonical base router must exist");
const base = source.slice(baseStart, baseEnd);
const routes = [
  ["/api/payments/status", "GET", "paymentStatus"],
  ["/api/payments/onboard", "POST", "paymentOnboard"],
  ["/api/payments/mission/create", "POST", "createMissionPayment"],
  ["/api/payments/mission/finalize", "POST", "finalizeMissionPayment"],
  ["/api/payments/payout", "POST", "payoutRequest"],
  ["/api/payments/dispute", "POST", "openPaymentDispute"],
  ["/api/payments/dispute/resolve", "POST", "paymentAdminResolve"]
];

test("every payment endpoint advertised by /api/info is explicitly routed", () => {
  const infoStart = base.indexOf("if (url.pathname === '/api/info')");
  const info = base.slice(infoStart);
  for (const [path, method, handler] of routes) {
    assert.ok(base.includes(`url.pathname === '${path}'`), `missing route: ${path}`);
    assert.ok(base.includes(`request.method !== '${method}'`), `missing method guard: ${path}`);
    assert.ok(base.includes(`return ${handler}(request, env)`), `missing handler dispatch: ${path}`);
    assert.ok(info.includes(path), `/api/info omits route: ${path}`);
  }
});

test("payment webhook is routed separately and remains POST-only", () => {
  const handleStart = source.indexOf("async function handle(request,env){");
  const handleEnd = source.indexOf("\nexport default {", handleStart);
  const handle = source.slice(handleStart, handleEnd);
  assert.match(handle, /url\.pathname === '\/api\/payments\/webhook'/);
  assert.match(handle, /return paymentWebhook\(request, env\)/);
  assert.match(source, /async function paymentWebhook\(request, env\)[\s\S]*?request\.method !== "POST"/);
});

test("payment routes cannot enable money movement by configuration alone", () => {
  assert.match(source, /export function paymentsConfigured\(env\)[\s\S]*?return false/);
  for (const name of ["paymentOnboard", "createMissionPayment", "payoutRequest", "openPaymentDispute"]) {
    const start = source.indexOf(`async function ${name}(request, env) {`);
    assert.ok(start >= 0, `${name} must exist`);
    const end = source.indexOf("\nasync function ", start + 1);
    const body = source.slice(start, end < 0 ? source.length : end);
    assert.match(body, /if \(!paymentsConfigured\(env\)\)/, `${name} must fail closed before writes`);
  }
  assert.match(base, /PAYMENT_PROVIDER_NOT_CONFIGURED/);
});
