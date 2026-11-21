import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = await readFile(new URL("src/index.js", root), "utf8");
const migration = await readFile(new URL("migrations-preview-canonical/0037_support_cases_tenant_isolation.sql", root), "utf8");

const authStart = source.indexOf("async function supportAuth(");
const authEnd = source.indexOf("\n}", authStart) + 2;
assert.ok(authStart >= 0 && authEnd > authStart);
const auth = source.slice(authStart, authEnd);

const createStart = source.indexOf("async function supportCreate(");
const createEnd = source.indexOf("\n}", createStart) + 2;
const create = source.slice(createStart, createEnd);

const listStart = source.indexOf("async function supportList(");
const listEnd = source.indexOf("\n}", listStart) + 2;
const list = source.slice(listStart, listEnd);

const resolveStart = source.indexOf("async function supportResolve(");
const resolveEnd = source.indexOf("\n}", resolveStart) + 2;
const resolve = source.slice(resolveStart, resolveEnd);

const dashboardStart = source.indexOf("async function supportDashboard(");
const dashboardEnd = source.indexOf("\n}", dashboardStart) + 2;
const dashboard = source.slice(dashboardStart, dashboardEnd);

test("support APIs require an authenticated active tenant", () => {
  assert.match(auth, /getSessionUser\(request,env\)/);
  assert.match(auth, /auth\.session_active_tenant_id/);
  assert.match(auth, /ACTIVE_TENANT_REQUIRED/);
  assert.match(auth, /return \{auth,role,tenantId\}/);
});

test("new support cases persist the server-resolved tenant, never a client tenant", () => {
  assert.match(create, /requires_manager,tenant_id\) VALUES/);
  assert.match(create, /requiresManager\?1:0,a\.tenantId/);
  assert.doesNotMatch(create, /b\.tenant_id|b\.tenantId/);
});

test("requesters and tenant managers can list only cases in their active tenant", () => {
  assert.match(list, /WHERE tenant_id=\? AND status=\?/);
  assert.match(list, /WHERE tenant_id=\? ORDER BY created_at/);
  assert.match(list, /WHERE tenant_id=\? AND requester_id=\? AND status=\?/);
  assert.match(list, /bind\(a\.tenantId/);
});

test("manager resolution reads and updates only a case in the active tenant", () => {
  assert.match(resolve, /WHERE id=\? AND tenant_id=\?/);
  assert.match(resolve, /bind\(id,a\.tenantId\)/);
  assert.match(resolve, /requires_manager=0 WHERE id=\? AND tenant_id=\?/);
  assert.match(resolve, /bind\(resolution,id,a\.tenantId\)/);
});

test("support dashboards aggregate only the active tenant", () => {
  assert.match(dashboard, /WHERE tenant_id=\? GROUP BY status,severity/);
  assert.match(dashboard, /WHERE tenant_id=\? ORDER BY created_at DESC/);
  assert.match(dashboard, /bind\(a\.tenantId\)/);
});

test("migration adds tenant scope and indexes without assigning legacy cases to an arbitrary tenant", () => {
  assert.match(migration, /ALTER TABLE support_cases ADD COLUMN tenant_id TEXT/);
  assert.match(migration, /idx_support_cases_tenant_status_created/);
  assert.match(migration, /idx_support_cases_tenant_requester_created/);
  assert.match(migration, /tenant_id NULL/);
  assert.doesNotMatch(migration, /UPDATE support_cases SET tenant_id/);
});

test("client-supplied execution_verified cannot auto-close a support case", () => {
  const start = source.indexOf("async function supportAutoResolve(");
  const end = source.indexOf("\\n}", start) + 2;
  assert.ok(start >= 0 && end > start);
  const resolver = source.slice(start, end);
  assert.match(resolver, /const verified=false/);
  assert.doesNotMatch(resolver, /context\\?\.execution_verified|context\.execution_verified/);
  assert.match(resolver, /NO_VERIFIED_DOWNSTREAM_ACTION/);
});
