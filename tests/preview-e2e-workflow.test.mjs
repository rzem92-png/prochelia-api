import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/preview-directory-e2e-acceptance.yml", import.meta.url), "utf8");

test("synthetic Preview E2E requires the exact branch, actor and commit marker or explicit manual confirmation", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /inputs\.confirmation == 'RUN_PREVIEW_DIRECTORY_E2E'/);
  assert.match(workflow, /github\.event_name == 'push'/);
  assert.match(workflow, /refs\/heads\/test\/preview-directory-e2e-current-pages-2026-11-24/);
  assert.match(workflow, /github\.actor == 'rzem92-png'/);
  assert.match(workflow, /contains\(github\.event\.head_commit\.message, '\[RUN_PREVIEW_DIRECTORY_E2E\]'\)/);
});

test("Preview E2E is pinned to the exact EU Preview D1 and current Pages branch commit", () => {
  assert.match(workflow, /PREVIEW_DB_NAME: prochelia-preview-eu-2026-11-17/);
  assert.match(workflow, /PREVIEW_DB_ID: e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /FRONTEND_BRANCH: fix\/frontend-accounting-readonly-proxy-2026-11-24/);
  assert.match(workflow, /24137dd2aeb83b76dd7b7584017c41ef545d9318/);
  assert.match(workflow, /deployment_trigger\.metadata\.branch/);
  assert.match(workflow, /deployment_trigger\.metadata\.commit_hash/);
  assert.ok(workflow.includes('[[ "$PREVIEW_DB_ID" != "04f52830-ef5a-4f17-a640-42bbc2381bba" ]]'));
});

test("Pages E2E uses the exact allowlisted alias and does not assume a service binding", () => {
  assert.match(workflow, /fix-frontend-accounting-read\.prochelia\.pages\.dev/);
  assert.match(workflow, /\.result\.aliases/);
  assert.match(workflow, /\.result\.services/);
  assert.match(workflow, /pinned Preview Worker origin/);
  assert.match(workflow, /\.result\.d1_databases\.DB\.id == \$db/);
});

test("Pages same-origin proxy tests the four protected intervenant routes and preflight", () => {
  for (const route of ["workspace", "opportunities", "assignments", "applications"]) {
    assert.ok(workflow.includes("/api/intervenant/" + route));
  }
  assert.match(workflow, /expected HTTP 401/);
  assert.match(workflow, /expected HTTP 204/);
  assert.match(workflow, /PAGES_PREVIEW_URL/);
});

test("tenant authentication and directory schema preflight runs before any synthetic seed", () => {
  const gate = workflow.indexOf("Verify tenant authentication and directory schema before seeding");
  const fixtureGeneration = workflow.indexOf("Generate synthetic test fixtures and guaranteed cleanup SQL");
  const seed = workflow.indexOf("Seed only the isolated Preview D1");
  assert.ok(gate >= 0, "read-only tenant schema gate is required");
  assert.ok(fixtureGeneration > gate, "schema gate must run before fixture generation");
  assert.ok(seed > gate, "schema gate must run before D1 seed");
  for (const column of [
    "tenants_table", "memberships_table", "session_active_tenant_id",
    "session_revoked_at", "clients_tenant_id", "intervenants_tenant_id"
  ]) assert.ok(workflow.includes(column), "missing readiness assertion: " + column);
  assert.match(workflow, /No synthetic fixture will be inserted/);
  assert.match(workflow, /EXISTS\(SELECT 1 FROM sqlite_master/);
  assert.match(workflow, /pragma_table_info\('sessions'\)/);
});

test("synthetic directory fixtures use the existing Preview schema and a dedicated cleanup", () => {
  assert.match(workflow, /INSERT INTO users \(id,role,email,first_name,last_name,status,password_hash\) VALUES/);
  assert.match(workflow, /INSERT INTO clients \(id,user_id,address,city,postal_code,notes,created_at,updated_at\) VALUES/);
  assert.match(workflow, /INSERT INTO intervenants \(id,user_id,professional_status,description,service_area,hourly_rate,validation_status,created_at,updated_at\) VALUES/);
  assert.match(workflow, /INSERT INTO sessions \(id,user_id,token_hash,expires_at\) VALUES/);
  assert.match(workflow, /DELETE FROM sessions/);
  assert.match(workflow, /DELETE FROM clients/);
  assert.match(workflow, /DELETE FROM intervenants/);
  assert.match(workflow, /DELETE FROM users/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /all synthetic Preview test rows and sessions removed/);
});

test("authenticated checks target the legacy Preview Worker explicitly and never Production", () => {
  assert.match(workflow, /https:\/\/prochelia-api-preview\.rzem92\.workers\.dev/);
  assert.match(workflow, /offset=not-a-number/);
  assert.ok(workflow.includes('[[ "$PREVIEW_DB_ID" != "04f52830-ef5a-4f17-a640-42bbc2381bba" ]]'));
  assert.doesNotMatch(workflow, /wrangler@4 d1 migrations apply|wrangler@4 deploy/);
});

test("authenticated same-origin Pages proxy forwards synthetic sessions and enforces role-scoped directory access", () => {
  assert.match(workflow, /Exercise authenticated same-origin Pages proxy with synthetic sessions/);
  assert.match(workflow, /Origin: base/);
  assert.match(workflow, /headers\.Cookie = 'prochelia_session=' \+ token/);
  assert.match(workflow, /E2E_MANAGER_TOKEN/);
  assert.match(workflow, /E2E_CLIENT_TOKEN/);
  assert.match(workflow, /await expectStatus\('\/api\/clients', null, 401\)/);
  assert.match(workflow, /await expectStatus\('\/api\/clients', client, 403\)/);
  assert.match(workflow, /Pages proxy client directory first-page contract mismatch/);
  assert.match(workflow, /Pages proxy did not return the synthetic intervenant fixture/);
});

test("Pages proxy acceptance is evaluated only after unconditional fixture cleanup", () => {
  const cleanup = workflow.indexOf("Always remove synthetic Preview fixtures and verify cleanup");
  const finalGate = workflow.indexOf("Enforce Pages proxy acceptance after synthetic Preview cleanup");
  assert.ok(cleanup >= 0 && finalGate > cleanup);
});

test("Cloudflare mismatch diagnostics never print tokens or authorization headers", () => {
  const marker = "Safe metadata diagnostic follows.";
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1);
  const block = workflow.slice(start, workflow.indexOf("exit 1", start));
  assert.match(block, /worker_service/);
  assert.match(block, /preview_aliases/);
  assert.doesNotMatch(block, /CLOUDFLARE_API_TOKEN|Authorization|Bearer/);
});
