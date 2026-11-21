import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations-preview-canonical/0038_identity_verification_tenant_scope.sql", import.meta.url), "utf8");

test("identity verification schema carries tenant ownership and an indexed tenant lookup", () => {
  assert.match(migration, /ADD COLUMN tenant_id TEXT REFERENCES tenants\(id\)/);
  assert.match(migration, /idx_identity_verifications_tenant_user_status/);
  assert.match(source, /user_id TEXT NOT NULL,\s*tenant_id TEXT REFERENCES tenants\(id\)/);
});

test("intervenant identity requests are created only in the authenticated session tenant", () => {
  const start = source.slice(source.indexOf("async function securityIdentityStart"), source.indexOf("async function securityIdentityApprove"));
  assert.match(start, /resolveTenantContext\(request, env, auth\)/);
  assert.match(start, /INSERT INTO identity_verifications \(id,user_id,tenant_id,status,level\)/);
  assert.match(start, /\.bind\(id, auth\.user\.id, tenantId\)/);
  assert.match(start, /tenant_id:tenantId/);
});

test("identity approval requires tenant membership role and tenant-scoped conditional update", () => {
  const start = source.indexOf("async function securityIdentityApprove");
  const end = source.indexOf("\nexport async function deliverSecurityCodes", start);
  const handler = source.slice(start, end);
  assert.match(handler, /resolveTenantContext\(request, env, auth\)/);
  assert.match(handler, /tenantRoleAllowed\(tenantContext, \['OWNER','ADMIN','MANAGER'\]\)/);
  assert.match(handler, /WHERE id=\? AND tenant_id=\? LIMIT 1/);
  assert.match(handler, /WHERE id=\? AND tenant_id=\? AND status='pending'/);
  assert.match(handler, /result\?\.meta\?\.changes \|\| 0\) !== 1/);
});

test("a verified identity can authorize mission preparation only inside the same tenant", () => {
  assert.match(source, /async function requireVerifiedIntervenant\(env, userId, tenantId\)/);
  assert.match(source, /WHERE user_id=\? AND tenant_id=\? AND status='verified'/);
  assert.match(source, /requireVerifiedIntervenant\(env,assignment\.intervenant_user_id,tenantId\)/);
});
