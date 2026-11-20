import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function intervenantWorkspaceReadModel(");
const end = source.indexOf("\nasync function handle(request,env){", start);
assert.ok(start >= 0 && end > start, "read-only workspace handler must exist");
const handler = source.slice(start, end);

test("the intervenant workspace route is GET-only and authenticated", () => {
  assert.match(source, /url\.pathname === '\/api\/intervenant\/workspace'/);
  assert.match(source, /request\.method !== 'GET'[\s\S]{0,160}METHOD_NOT_ALLOWED/);
  assert.match(handler, /getSessionUser\(request, env\)/);
  assert.match(handler, /requireRole\(auth, \['intervenant'\]\)/);
});

test("the workspace scopes the profile to the authenticated user", () => {
  assert.match(handler, /FROM intervenants WHERE user_id=\? LIMIT 1/);
  assert.match(handler, /first_name:auth\.user\.first_name/);
  assert.match(handler, /last_name:auth\.user\.last_name/);
  assert.match(handler, /\.bind\(auth\.user\.id\)\.first\(\)/);
});

test("mission rows are scoped to the authenticated user's intervenant profile", () => {
  assert.match(handler, /WHERE m\.intervenant_id=\?/);
  assert.match(handler, /\.bind\(profile\.id\)\.all\(\)/);
  assert.match(handler, /LIMIT 50/);
});

test("wallet and documents are scoped to the authenticated user", () => {
  assert.match(handler, /FROM wallets WHERE user_id=\?/);
  assert.match(handler, /FROM documents WHERE user_id=\?/);
  assert.match(handler, /FROM evaluations WHERE target_user_id=\?/);
});

test("the workspace is read-only and never initializes financial schemas", () => {
  assert.match(handler, /read_only:true,writes:false/);
  assert.doesNotMatch(handler, /ensurePaymentSchema|INSERT INTO|UPDATE\s+wallets|payoutRequest\(/);
  assert.match(handler, /real_payments_enabled:paymentsConfigured\(env\)/);
});

test("the projection does not expose client addresses or raw documents", () => {
  assert.doesNotMatch(handler, /m\.address|file_reference|provider_account_id/);
  assert.match(handler, /partial_data:partial/);
});
