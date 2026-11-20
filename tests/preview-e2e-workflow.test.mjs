import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/preview-directory-e2e-acceptance.yml", import.meta.url), "utf8");

test("Preview E2E is gated by explicit confirmation or a successful isolated Preview deployment", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /RUN_PREVIEW_DIRECTORY_E2E/);
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
});

test("Preview E2E resolves the current matching Pages Preview deployment dynamically", () => {
  assert.match(workflow, /PREVIEW_DB_ID: e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /FRONTEND_BRANCH: feat\/intervenant-secure-pages-integration-2026-11-20/);
  assert.match(workflow, /api\.github\.com\/repos\/rzem92-png\/-prochelia\/branches/);
  assert.match(workflow, /pages\/projects\/prochelia\/deployments\?env=preview&per_page=100/);
  assert.match(workflow, /deployment_trigger\.metadata\.branch/);
  assert.match(workflow, /deployment_trigger\.metadata\.commit_hash/);
  assert.match(workflow, /PAGES_DEPLOYMENT_ID=%s/);
  assert.match(workflow, /PAGES_PREVIEW_URL=%s/);
  assert.match(workflow, /prochelia-api-preview/);
  assert.doesNotMatch(workflow, /83a36d32|3846562300e97a1816b2aa7e317448449270c2bc|e69fde70fb28405aa8117eaf041aed618d3da664/);
  assert.doesNotMatch(workflow, /PREVIEW_DB_ID: 04f52830-ef5a-4f17-a640-42bbc2381bba/);
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
  assert.match(workflow, /all synthetic Preview test rows and sessions removed/);
});


test("Preview directory acceptance exercises the deployed Worker and deterministic synthetic ordering", () => {
  assert.match(workflow, /https:\/\/prochelia-api-preview\.rzem92\.workers\.dev/);
  assert.match(workflow, /created_at,updated_at/);
  assert.match(workflow, /9999-12-31 23:59:59/);
  assert.match(workflow, /offset=not-a-number/);
  assert.doesNotMatch(workflow, /offset=50001/);
});

test("Preview E2E exercises the real same-origin Pages-to-Worker proxy without session or data writes", () => {
  assert.match(workflow, /Exercise same-origin Pages-to-Worker proxy without a session/);
  for (const route of ["workspace","opportunities","assignments","applications"]) {
    assert.match(workflow, new RegExp("/api/intervenant/" + route));
  }
  assert.match(workflow, /expected HTTP 401/);
  assert.match(workflow, /options_status/);
  assert.match(workflow, /expected HTTP 204/);
  assert.match(workflow, /service binding/);
});
