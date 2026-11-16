import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("identity status endpoint is GET-only and routed to the server handler", () => {
  assert.match(source, /url\.pathname === '\/api\/security\/identity\/status'/);
  assert.match(source, /request\.method !== 'GET'.{0,180}securityIdentityStatus\(request, env\)/s);
});

test("identity status requires an authenticated intervenant session", () => {
  const start = source.indexOf("async function securityIdentityStatus(request, env)");
  const end = source.indexOf("async function securityIdentityStart(request, env)", start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /getSessionUser\(request, env\)/);
  assert.match(handler, /requireRole\(auth, \['intervenant'\]\)/);
  assert.match(handler, /UNAUTHENTICATED/);
  assert.match(handler, /FORBIDDEN/);
});

test("identity gate is based on a verified, non-expired server D1 record", () => {
  const start = source.indexOf("async function securityIdentityStatus(request, env)");
  const end = source.indexOf("async function securityIdentityStart(request, env)", start);
  const handler = source.slice(start, end);
  assert.match(handler, /requireVerifiedIntervenant\(env, auth\.user\.id\)/);
  assert.match(handler, /authority:'SERVER_D1'/);
  assert.match(handler, /identity_gate_passed:identityPassed/);
});

test("profile gate requires a server-validated intervenant record and verified unexpired documents", () => {
  const start = source.indexOf("async function securityIdentityStatus(request, env)");
  const end = source.indexOf("async function securityIdentityStart(request, env)", start);
  const handler = source.slice(start, end);
  assert.match(handler, /FROM intervenants i/);
  assert.match(handler, /LEFT JOIN documents d ON d\.user_id=i\.user_id/);
  assert.match(handler, /i\.validation_status/);
  assert.match(handler, /d\.status='verified'/);
  assert.match(handler, /d\.expires_at > CURRENT_TIMESTAMP/);
  assert.match(handler, /Number\(profile\.document_count \|\| 0\) > 0/);
  assert.match(handler, /profile_gate_passed:profilePassed/);
});
