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

test("synthetic Preview E2E can be manually dispatched from its dedicated PR branch without merging", () => {
  assert.ok(workflow.includes("github.ref == 'refs/heads/fix/preview-e2e-dynamic-pages-pin-2026-11-17'"));
  assert.ok(workflow.includes("github.event_name == 'workflow_dispatch'"));
  assert.ok(workflow.includes("inputs.confirmation == 'RUN_PREVIEW_DIRECTORY_E2E'"));
});

test("Preview E2E resolves the latest Pages Preview deployment instead of stale hardcoded IDs", () => {
  assert.match(workflow, /PREVIEW_DB_ID: e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /PAGES_PREVIEW_BRANCH:/);
  assert.match(workflow, /PAGES_EXPECTED_COMMIT: \\$\{\\{ inputs\\.pages_commit_sha \\|\\| '' \\}\\}/);
  assert.match(workflow, /\(\$expected == "" or \.result\.deployment_trigger\.metadata\.commit_hash == \$expected\)/);
  assert.doesNotMatch(workflow, /579679da7ca3a68b91448a85e7151bda5794a155/);
  assert.match(workflow, /pages\/projects\/prochelia\/deployments\?env=preview&per_page=1&page=1/);
  assert.match(workflow, /\.result\[0\]\.id/);
  assert.match(workflow, /\.result\.latest_stage\.status == "success"/);
  assert.match(workflow, /\.result\.uses_functions == true/);
  assert.match(workflow, /\.result\.d1_databases\.DB\.id == \$db/);
  assert.match(workflow, /\.result\.services\.PROCHELIA_API\.service == \$worker/);
  assert.match(workflow, /\.result\.deployment_trigger\.metadata\.branch == \$branch/);
  assert.match(workflow, /\.result\.deployment_trigger\.metadata\.commit_hash/);
  assert.doesNotMatch(workflow, /83a36d32-4880-4417-a684-f9247e42debf/);
  assert.doesNotMatch(workflow, /83a36d32\.prochelia\.pages\.dev/);
  assert.doesNotMatch(workflow, /3846562300e97a1816b2aa7e317448449270c2bc/);
  assert.doesNotMatch(workflow, /e69fde70fb28405aa8117eaf041aed618d3da664/);
  assert.doesNotMatch(workflow, /PREVIEW_DB_ID: 04f52830-ef5a-4f17-a640-42bbc2381bba/);
});

test("Pages commit is resolved dynamically unless an exact optional SHA is supplied", () => {
  assert.match(workflow, /pages_commit_sha:/);
  assert.match(workflow, /pages_commit_sha must be an exact 40-character lowercase Git SHA/);
  assert.match(workflow, /\(\$expected == "" or \.result\.deployment_trigger\.metadata\.commit_hash == \$expected\)/);
});

test("Pages Preview configuration and deployment are checked independently from Production", () => {
  assert.match(workflow, /deployment_configs\.preview\.d1_databases\.DB\.id == \$db/);
  assert.match(workflow, /deployment_configs\.preview\.services\.PROCHELIA_API\.service == \$worker/);
  assert.match(workflow, /deployment_configs\.production\.d1_databases\.DB\.id/);
  assert.match(workflow, /\.result\.environment == "preview"/);
  assert.match(workflow, /\.result\.is_skipped == false/);
});

test("Preview Worker CORS allowlist must contain the exact current Pages Preview origin", () => {
  assert.ok(workflow.includes("workers/scripts/prochelia-api-preview/settings"));
  assert.ok(workflow.includes("CORS_ORIGIN"));
  assert.ok(workflow.includes('IFS=\',\' read -r -a allowed_origins <<< "$cors_origin"'));
  assert.ok(workflow.includes('== "$pages_url"'));
  assert.ok(workflow.includes("Do not change the Production Worker"));
});

test("Pages same-origin proxy probes the Worker Origin guard without creating business data", () => {
  assert.ok(workflow.includes("originProbe"));
  assert.ok(workflow.includes("/api/missions/validate"));
  assert.ok(workflow.includes("originProbeBody.error !== 'AUTHENTICATED_VALIDATION_REQUIRED'"));
  assert.ok(workflow.includes("origin: base"));
});

test("Pages binding mismatch diagnostics expose only non-secret deployment metadata", () => {
  const marker = "Latest Pages Preview deployment is stale, skipped, failed, misbound, or built from an unexpected branch/commit.";
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, "safe mismatch diagnostic must exist");
  const block = workflow.slice(start, workflow.indexOf("exit 1", start));
  for (const field of ["id", "environment", "is_skipped", "latest_stage", "uses_functions", "d1_database_id", "worker_service", "branch", "commit_hash"]) {
    assert.match(block, new RegExp(field));
  }
  assert.doesNotMatch(block, /CLOUDFLARE_API_TOKEN|Authorization|Bearer/);
});

test("Pages-to-Worker health and authenticated directory journeys use the Pages Preview origin", () => {
  assert.match(workflow, /Verify Pages-to-Worker health path/);
  assert.match(workflow, /new URL\('\/api\/health', process\.env\.PAGES_PREVIEW_URL\)/);
  assert.match(workflow, /body\.ok !== true \|\| body\.database !== true/);
  assert.match(workflow, /const base = process\.env\.PAGES_PREVIEW_URL/);
  assert.doesNotMatch(workflow, /const base = 'https:\/\/prochelia-api-preview\.rzem92\.workers\.dev'/);
  assert.match(workflow, /unauthenticated 401/);
  assert.match(workflow, /client role 403/);
  assert.match(workflow, /directory pagination/);
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

test("Preview directory acceptance uses deterministic synthetic ordering and bounded offsets", () => {
  assert.match(workflow, /created_at,updated_at/);
  assert.match(workflow, /9999-12-31 23:59:59/);
  assert.match(workflow, /offset=not-a-number/);
  assert.doesNotMatch(workflow, /offset=50001/);
});
