import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("mutations without Origin are denied except exact bootstrap and signed-webhook entry points", () => {
  const policy = source.slice(source.indexOf("function isMutatingMethod"), source.indexOf("async function ensureCommercialRecruitmentSchema"));
  assert.match(policy, /function originlessMutationAllowed/);
  assert.match(policy, /url\.pathname==='\/api\/auth\/bootstrap'/);
  assert.match(policy, /url\.pathname==='\/api\/payments\/webhook'/);
  assert.match(policy, /return !isMutatingMethod\(request\.method\) \|\| originlessMutationAllowed\(request,env\)/);
  assert.match(policy, /if\(!configured\) return false/);
  assert.doesNotMatch(policy, /const defaults=/);
});

test("browser sessions remain HttpOnly cookie-only and are not returned in login JSON", () => {
  assert.match(source, /return getCookie\(request,SESSION_COOKIE\)/);
  assert.doesNotMatch(source, /authorization\.match\(\/\^Bearer\\s\+/);
  assert.match(source, /HttpOnly; Secure; SameSite=Lax/);
  const handler = source.slice(source.indexOf("async function login"), source.indexOf("async function logout"));
  assert.doesNotMatch(handler, /user: safeUser\(user\), token/);
});

test("manual payment finalization cannot mark a transaction paid or refunded without a signed PSP event", () => {
  const handler = source.slice(source.indexOf("async function finalizeMissionPayment"), source.indexOf("async function payoutRequest"));
  assert.match(handler, /PSP_CONFIRMED_OUTCOME_REQUIRED/);
  assert.match(handler, /!\[\x27failed\x27,\x27held\x27\]\.includes\(outcome\)/);
});

test("cookie-authenticated mutations require a session-bound CSRF token", () => {
  const csrf = source.slice(source.indexOf("async function csrfTokenForSession"), source.indexOf("function requireRole"));
  const handler = source.slice(source.indexOf("async function handle(request,env)"));
  assert.match(csrf, /name:'HMAC',hash:'SHA-256'/);
  assert.match(csrf, /PROCHELIA-CSRF-v1:/);
  assert.match(csrf, /constantTimeStringEqual/);
  assert.match(handler, /csrfExemptPaths = new Set\(\['\/api\/auth\/login', '\/api\/auth\/bootstrap', '\/api\/payments\/webhook'\]\)/);
  assert.match(handler, /csrfTokenForSession\(auth\)/);
  assert.match(handler, /CSRF_TOKEN_INVALID/);
  assert.match(source, /url\.pathname === '\/api\/auth\/csrf'/);
  assert.match(source, /return authCsrf\(request, env\)/);
  assert.match(csrf, /'cache-control': 'no-store'/);
});

test("all support/system authorization helpers reference the real session resolver", () => {
  assert.equal(/\bgetAuth\s*\(/.test(source), false, "undefined getAuth() calls must not remain");
  assert.match(source, /async function supportAuth\(request,env\)[\s\S]*?getSessionUser\(request,env\)/);
});

test("system scale and backup routes require an authenticated GERANTE session", () => {
  const marker = "const __procheliaNationalHandle = handle";
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, "national system handler must exist");
  const end = source.indexOf("PROCHÉLIA — COMPLÉMENT MAÎTRE", start);
  assert.notEqual(end, -1, "national system handler boundary must exist");
  const routes = source.slice(start, end);

  const protectedRoutes = [
    ["GET", "/api/system/scale", "nationalScaleStatus"],
    ["GET", "/api/system/backups", "backupStatus"],
    ["POST", "/api/system/backup/run", "runNationalBackup"]
  ];

  for (const [method, path, action] of protectedRoutes) {
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const route = new RegExp(
      "request\\.method===['\"]" + method + "['\"]&&url\\.pathname===['\"]" +
      escapedPath + "['\"][\\s\\S]*?(?=\\n\\s*if\\(request\\.method|\\n\\s*return __procheliaNationalHandle|$)"
    );
    const match = routes.match(route);
    assert.ok(match, `expected protected route ${method} ${path}`);
    assert.match(match[0], /getSessionUser\(request,env\)/, `${path} must resolve the session`);
    assert.match(match[0], /!auth\?\.user\|\|String\(auth\.user\.role\|\|''\)\.toUpperCase\(\)!=='GERANTE'/, `${path} must deny missing or non-GERANTE sessions`);
    assert.match(match[0], new RegExp(action), `${path} must call its expected action only after authorization`);
  }
});
