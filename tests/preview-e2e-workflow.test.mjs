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

test("Preview E2E pins its own D1, Worker and Pages deployment", () => {
  assert.match(workflow, /PREVIEW_DB_ID: 6adb95e5-e542-4bec-9008-fbea01042305/);
  assert.match(workflow, /PAGES_DEPLOYMENT_ID: c3ceec86-8372-462d-b932-cfe18ca55085/);
  assert.match(workflow, /prochelia-api-preview/);
  assert.match(workflow, /e69fde70fb28405aa8117eaf041aed618d3da664/);
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

test("Synthetic Preview E2E fixtures are cleaned up and cleanup is verified", () => {
  assert.match(workflow, /Generate synthetic test fixtures and guaranteed cleanup SQL/);
  assert.match(workflow, /Always remove synthetic Preview fixtures and verify cleanup/);
  assert.match(workflow, /all synthetic Preview test rows and sessions removed/);
});
