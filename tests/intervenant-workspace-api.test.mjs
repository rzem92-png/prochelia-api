import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function intervenantWorkspaceReadModel(");
const end = source.indexOf("\nasync function handle(request,env){", start);
assert.ok(start >= 0 && end > start, "workspace read model must exist in canonical API Worker");
const handler = source.slice(start, end);

test("intervenant workspace is routed through the canonical API Worker and GET only", () => {
  assert.match(source, /url\.pathname === '\/api\/intervenant\/workspace'/);
  assert.match(handler, /request\.method !== 'GET'[\s\S]{0,80}METHOD_NOT_ALLOWED/);
});

test("workspace requires an authenticated intervenant role", () => {
  assert.match(handler, /getSessionUser\(request, env\)/);
  assert.match(handler, /requireRole\(auth, \['intervenant'\]\)/);
  assert.match(handler, /AUTHENTICATION_SCHEMA_UNAVAILABLE/);
  assert.match(handler, /AUTHENTICATION_SCHEMA_UNAVAILABLE' \}, 503/);
  assert.match(handler, /UNAUTHENTICATED/);
  assert.match(handler, /FORBIDDEN/);
});

test("workspace resources are scoped to the authenticated owner", () => {
  assert.match(handler, /FROM intervenants WHERE user_id = \?/);
  assert.match(handler, /WHERE m\.intervenant_id = \?/);
  assert.match(handler, /FROM disponibilites WHERE intervenant_id = \?/);
  assert.match(handler, /FROM wallets WHERE user_id = \?/);
  assert.match(handler, /FROM documents WHERE user_id = \?/);
});

test("workspace response is read-only and excludes client addresses and raw document references", () => {
  assert.match(handler, /read_only: true/);
  assert.match(handler, /writes: false/);
  assert.doesNotMatch(handler, /m\.address|file_reference|provider_account_id|INSERT INTO|UPDATE\s+wallets/);
});

test("missing optional workspace tables are reported as partial data, not fabricated", () => {
  assert.match(handler, /partial\.push\('missions'\)/);
  assert.match(handler, /partial\.push\('availability'\)/);
  assert.match(handler, /partial\.push\('wallet'\)/);
  assert.match(handler, /partial\.push\('documents'\)/);
});

test("workspace fails closed until an active tenant and tenant-scoped business tables exist", () => {
  assert.match(handler, /ACTIVE_TENANT_REQUIRED/);
  assert.match(handler, /BUSINESS_TENANT_SCHEMA_UNAVAILABLE/);
  for (const table of ["intervenants", "missions", "disponibilites", "wallets", "documents"]) {
    assert.match(handler, new RegExp("PRAGMA table_info\\(" + table + "\\\\)"));
  }
  assert.match(handler, /auth\.session_active_tenant_id/);
});
