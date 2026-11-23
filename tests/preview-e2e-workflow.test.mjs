import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/preview-directory-e2e-acceptance.yml", import.meta.url), "utf8");

test("Preview E2E is limited to audited API branches, the Pages proxy branch and explicit manual confirmation", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /RUN_PREVIEW_DIRECTORY_E2E/);
  assert.match(workflow, /github\.event_name == 'push'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/feat\/supra-canonical-tenant-integration-2026-11-20'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/fix\/tenant-accounting-api-readonly-gate-2026-11-22'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/fix\/pages-proxy-preview-cors-2026-11-23'/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
});

test("Preview E2E pins the current Pages proxy branch and exact deployment commit", () => {
  assert.match(workflow, /PREVIEW_DB_ID: e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /FRONTEND_BRANCH: pages-proxy-2026-11-23/);
  assert.match(workflow, /FRONTEND_COMMIT_SHA: \$\{\{ inputs\.frontend_commit_sha/);
  assert.match(workflow, /e548a3acbf19dec646b9a5d61fdfcdd00e435826/);
  assert.match(workflow, /default: "e548a3acbf19dec646b9a5d61fdfcdd00e435826"/);
  assert.match(workflow, /API_PREVIEW_URL: https:\/\/fix-pages-proxy-preview-cors-2026-11-23-prochelia-api\.rzem92\.workers\.dev/);
  assert.match(workflow, /https:\/\/pages-proxy-2026-11-23\.prochelia\.pages\.dev/);
  assert.match(workflow, /pages\/projects\/prochelia\/deployments\?env=preview&per_page=10/);
  assert.match(workflow, /deployment_trigger\.metadata\.branch/);
  assert.match(workflow, /deployment_trigger\.metadata\.commit_hash/);
  assert.match(workflow, /uses_functions == true/);
  assert.match(workflow, /prochelia-api-preview/);
  assert.doesNotMatch(workflow, /PREVIEW_DB_ID: 04f52830-ef5a-4f17-a640-42bbc2381bba/);
});

test("synthetic SQL and GITHUB_ENV use real newline escapes, and cleanup sends valid JSON", () => {
  assert.match(workflow, /\.join\(',\\n'\)/);
  assert.match(workflow, /E2E_MANAGER_TOKEN=\$\{managerToken\}\\nE2E_CLIENT_TOKEN=/);
  assert.match(workflow, /payload="\$\(cat <<EOF/);
  assert.match(workflow, /\{"sql":"SELECT \(SELECT COUNT\(\*\) FROM users/);
  assert.doesNotMatch(workflow, /\\\\n/);
});

test("Cloudflare Pages list response supports its array result shape", () => {
  assert.ok(workflow.includes('(if type == "array" then . else (.deployments // []) end)'));
});

test("Pages proxy final gate runs after unconditional synthetic fixture cleanup", () => {
  const cleanup = workflow.indexOf("Always remove synthetic Preview fixtures and verify cleanup");
  const gate = workflow.indexOf("Enforce Pages proxy acceptance after synthetic Preview cleanup");
  assert.ok(cleanup >= 0 && gate > cleanup, "cleanup must precede the final Pages proxy gate");
});

test("Pages proxy gaps are reported without skipping independent synthetic Worker tests", () => {
  assert.ok(workflow.includes("id: pages_proxy"));
  assert.ok(workflow.includes("continue-on-error: true"));
  assert.ok(workflow.includes("proxy_gap=1"));
  assert.ok(workflow.includes("Enforce Pages proxy acceptance after synthetic Preview cleanup"));
  assert.ok(workflow.includes("${{ steps.pages_proxy.outcome }}"));
  assert.ok(workflow.includes("Always remove synthetic Preview fixtures and verify cleanup"));
});

test("Pages binding mismatch diagnostics expose only non-secret deployment metadata", () => {
  const marker = "Safe metadata diagnostic follows.";
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, "safe mismatch diagnostic must exist");
  const block = workflow.slice(start, workflow.indexOf("exit 1", start));
  for (const field of ["environment", "uses_functions", "d1_database_id", "worker_service", "commit_hash"]) {
    assert.match(block, new RegExp(field));
  }
  assert.doesNotMatch(block, /CLOUDFLARE_API_TOKEN|Authorization|Bearer/);
});

test("Preview E2E synthetic users provide every required users field, including password_hash", () => {
  assert.match(workflow, /INSERT INTO users \(id,role,email,first_name,last_name,status,password_hash\) VALUES/);
  assert.match(workflow, /q\('active'\),q\(hash\(randomBytes\(48\)\.toString\('base64url'\)\)\)/);
});

test("Synthetic Preview E2E fixtures are cleaned up and cleanup is verified", () => {
  assert.match(workflow, /Generate synthetic test fixtures and guaranteed cleanup SQL/);
  assert.match(workflow, /Always remove synthetic Preview fixtures and verify cleanup/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /all synthetic Preview test rows and sessions removed/);
});

test("Preview directory acceptance exercises the real Worker and deterministic synthetic ordering", () => {
  assert.match(workflow, /const base = process\.env\.API_PREVIEW_URL;/);
  assert.doesNotMatch(workflow, /https:\/\/prochelia-api-preview\.rzem92\.workers\.dev/);
  assert.match(workflow, /created_at,updated_at/);
  assert.match(workflow, /9999-12-31 23:59:59/);
  assert.match(workflow, /offset=not-a-number/);
  assert.doesNotMatch(workflow, /offset=50001/);
});

test("Pages proxy verifies unauthenticated workspace routes, exact Origin forwarding and preflight", () => {
  assert.match(workflow, /Exercise same-origin Pages-to-Worker proxy without a session/);
  for (const route of ["workspace", "opportunities", "assignments", "applications"]) {
    assert.match(workflow, new RegExp("/api/intervenant/" + route));
  }
  assert.match(workflow, /expected HTTP 401/);
  assert.match(workflow, /api\/tenant\/select/);
  assert.match(workflow, /tenant_select_status/);
  assert.match(workflow, /Access-Control-Allow-Origin|access-control-allow-origin/);
  assert.match(workflow, /expected HTTP 204/);
  assert.match(workflow, /pinned Worker branch Preview/);
});
test("authenticated directory fixtures are gated on tenant-scoped Preview schema before any write", () => {
  assert.match(workflow, /Verify tenant-scoped directory schema before synthetic data writes/);
  assert.match(workflow, /steps\.tenant_schema\.outputs\.ready == 'true'/);
  assert.match(workflow, /TENANT_SCHEMA_NOT_READY/);
  assert.match(workflow, /pragma_table_info/);
  assert.match(workflow, /no synthetic fixture rows will be written/);
});
