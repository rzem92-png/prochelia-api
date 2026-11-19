import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/preview-directory-e2e-acceptance.yml", import.meta.url), "utf8");

test("Preview E2E is manually gated and requires an exact frontend Pages commit SHA", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.ok(!workflow.includes("workflow_run:"));
  assert.ok(workflow.includes("RUN_PREVIEW_DIRECTORY_E2E"));
  assert.ok(workflow.includes("pages_branch:"));
  assert.ok(workflow.includes("PAGES_PREVIEW_BRANCH: ${{ inputs.pages_branch || '' }}"));
  assert.ok(workflow.includes('[[ -n "$PAGES_PREVIEW_BRANCH" && "$PAGES_PREVIEW_BRANCH" != "main" ]]'));
  assert.ok(!workflow.includes("fix/frontend-cookie-session-auth-2026-11-17"));
  assert.ok(workflow.includes("pages_commit_sha:"));
  assert.ok(workflow.includes("required: true"));
  assert.ok(!workflow.includes('default: "fix/frontend-cookie-session-auth-2026-11-17"'));
  assert.ok(workflow.includes("pages_commit_sha is required and must be an exact 40-character lowercase Git SHA"));
});

test("synthetic Preview E2E can be manually dispatched from its dedicated PR branch without merging", () => {
  assert.ok(workflow.includes("github.ref == 'refs/heads/fix/preview-e2e-dynamic-pages-pin-2026-11-17'"));
  assert.ok(workflow.includes("github.event_name == 'workflow_dispatch'"));
  assert.ok(workflow.includes("inputs.confirmation == 'RUN_PREVIEW_DIRECTORY_E2E'"));
});

test("Preview E2E resolves the latest Pages Preview deployment instead of stale hardcoded IDs", () => {
  assert.match(workflow, /PREVIEW_DB_ID: e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /PAGES_PREVIEW_BRANCH:/);
  assert.ok(workflow.includes("PAGES_EXPECTED_COMMIT: ${{ inputs.pages_commit_sha || '' }}"));
  assert.ok(workflow.includes('.result.deployment_trigger.metadata.commit_hash == $expected'));
  assert.doesNotMatch(workflow, /579679da7ca3a68b91448a85e7151bda5794a155/);
  assert.match(workflow, /pages\/projects\/prochelia\/deployments\?env=preview&per_page=1&page=1/);
  assert.match(workflow, /\.result\[0\]\.id/);
  assert.match(workflow, /\.result\.latest_stage\.status == "success"/);
  assert.match(workflow, /\.result\.uses_functions == true/);
  assert.match(workflow, /\.result\.d1_databases\.DB\.id == \$db/);
  assert.match(workflow, /\.result\.services\.PROCHELIA_API\.service == \$worker/);
  assert.ok(workflow.includes('.result.deployment_configs.preview.env_vars.SUPRA_API_ORIGIN.value == $api_origin'));
  assert.ok(workflow.includes('api_origin "https://prochelia-api-preview.rzem92.workers.dev"'));
  assert.match(workflow, /\.result\.deployment_trigger\.metadata\.branch == \$branch/);
  assert.match(workflow, /\.result\.deployment_trigger\.metadata\.commit_hash/);
  assert.doesNotMatch(workflow, /83a36d32-4880-4417-a684-f9247e42debf/);
  assert.doesNotMatch(workflow, /83a36d32\.prochelia\.pages\.dev/);
  assert.doesNotMatch(workflow, /3846562300e97a1816b2aa7e317448449270c2bc/);
  assert.doesNotMatch(workflow, /e69fde70fb28405aa8117eaf041aed618d3da664/);
  assert.doesNotMatch(workflow, /PREVIEW_DB_ID: 04f52830-ef5a-4f17-a640-42bbc2381bba/);
});

test("Pages deployment commit must equal the required explicit frontend SHA pin", () => {
  assert.ok(workflow.includes("pages_commit_sha:"));
  assert.ok(workflow.includes("required: true"));
  assert.ok(workflow.includes("PAGES_EXPECTED_COMMIT: ${{ inputs.pages_commit_sha || '' }}"));
  assert.ok(workflow.includes("pages_commit_sha is required and must be an exact 40-character lowercase Git SHA"));
  assert.ok(workflow.includes('.result.deployment_trigger.metadata.commit_hash == $expected'));
  assert.ok(!workflow.includes("api.github.com/repos/rzem92-png/-prochelia/commits"));
});

test("Pages Preview configuration and deployment are checked independently from Production", () => {
  assert.match(workflow, /deployment_configs\.preview\.d1_databases\.DB\.id == \$db/);
  assert.match(workflow, /deployment_configs\.preview\.services\.PROCHELIA_API\.service == \$worker/);
  assert.match(workflow, /deployment_configs\.production\.d1_databases\.DB\.id/);
  assert.match(workflow, /\.result\.environment == "preview"/);
  assert.match(workflow, /\.result\.is_skipped == false/);
});

test("Pages same-origin proxy is pinned to the isolated Preview Worker without a redundant CORS gate", () => {
  assert.ok(workflow.includes("workers/scripts/prochelia-api-preview/settings"));
  assert.ok(workflow.includes("SUPRA_API_ORIGIN"));
  assert.ok(workflow.includes("PROCHELIA_API.service"));
  assert.ok(workflow.includes("https://prochelia-api-preview.rzem92.workers.dev"));
  assert.ok(workflow.includes("PAGES_PREVIEW_ALIAS="));
  assert.ok(!workflow.includes("cors_origin="));
  assert.ok(!workflow.includes("expected_origins"));
});

test("Pages same-origin proxy probes the Worker Origin guard without creating business data", () => {
  assert.ok(workflow.includes("originProbe"));
  assert.ok(workflow.includes("/api/missions/validate"));
  assert.ok(workflow.includes("originProbeBody.error !== 'AUTHENTICATED_VALIDATION_REQUIRED'"));
  assert.ok(workflow.includes("rejectedOriginProbe"));
  assert.ok(workflow.includes("rejectedOriginBody.error !== 'ORIGIN_NOT_ALLOWED'"));
  assert.ok(workflow.includes("https://untrusted.example"));
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


test("Live E2E pins the deployed Preview Worker independently from the workflow source commit", () => {
  assert.ok(workflow.includes("api_commit_sha:"));
  assert.ok(workflow.includes("API_EXPECTED_COMMIT: ${{ inputs.api_commit_sha || '' }}"));
  assert.ok(workflow.includes("api_commit_sha is required and must be an exact 40-character lowercase Git SHA"));
  assert.ok(workflow.includes("PROCHELIA_COMMIT_SHA"));
  assert.ok(workflow.includes('[[ "$worker_commit" == "$API_EXPECTED_COMMIT" ]]'));
  assert.ok(!workflow.includes("API_EXPECTED_COMMIT: ${{ github.sha }}"));
  assert.ok(workflow.includes("ref: ${{ github.sha }}"));
  assert.ok(workflow.includes("body.deployment_commit !== process.env.API_EXPECTED_COMMIT"));
  assert.ok(workflow.includes("Preview Worker commit mismatch"));
});
