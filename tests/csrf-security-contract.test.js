import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("session CSRF endpoint is authenticated and never cacheable", () => {
  const csrf = source.slice(source.indexOf("async function csrfTokenForSession"), source.indexOf("function requireRole"));
  assert.match(csrf, /name:'HMAC',hash:'SHA-256'/);
  assert.match(csrf, /PROCHELIA-CSRF-v1:/);
  assert.match(csrf, /cache-control':'no-store/);
  assert.match(source, /url\.pathname === '\/api\/auth\/csrf'/);
  assert.match(source, /return authCsrf\(request, env\)/);
  assert.match(source, /function constantTimeStringEqual\(/);
});

test("cookie-authenticated mutations require a valid session-bound CSRF header", () => {
  const handler = source.slice(source.indexOf("async function handle(request,env)"));
  assert.match(handler, /csrfExemptPaths = new Set\(\['\/api\/auth\/login', '\/api\/auth\/bootstrap', '\/api\/payments\/webhook'\]\)/);
  assert.match(handler, /getSessionToken\(request\)/);
  assert.match(handler, /csrfTokenForSession\(auth\)/);
  assert.match(handler, /constantTimeStringEqual\(supplied, expected\)/);
  assert.match(handler, /CSRF_TOKEN_INVALID/);
});

test("mutations require explicit Origin allowlisting except narrowly guarded server callbacks", () => {
  const policy = source.slice(source.indexOf("function isMutatingMethod"), source.indexOf("async function ensureCommercialRecruitmentSchema"));
  assert.match(policy, /function originlessMutationAllowed/);
  assert.match(policy, /url\.pathname==='\/api\/auth\/bootstrap'/);
  assert.match(policy, /url\.pathname==='\/api\/payments\/webhook'/);
  assert.match(policy, /return !isMutatingMethod\(request\.method\) \|\| originlessMutationAllowed\(request,env\)/);
  assert.match(policy, /if\(!configured\) return false/);
  assert.doesNotMatch(policy, /const defaults=/);
});

test("browser session token remains in an HttpOnly Secure cookie", () => {
  assert.match(source, /function getSessionToken\(request\)/);
  assert.match(source, /return getCookie\(request, SESSION_COOKIE\)/);
  assert.match(source, /HttpOnly; Secure; SameSite=Lax/);
});
