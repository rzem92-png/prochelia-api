import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const previewText = await readFile(new URL("../wrangler.preview.jsonc", import.meta.url), "utf8");
const productionText = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const deployWorkflow = await readFile(new URL("../.github/workflows/deploy-supra-preview-manual.yml", import.meta.url), "utf8");
const preview = JSON.parse(previewText);
const production = JSON.parse(productionText);
const expectedPreviewId = "e3cf167c-37e1-4d72-9ac6-b3e27c14b97f";
const expectedPreviewName = "prochelia-preview-eu-2026-11-17";

test("preview Worker uses the currently verified isolated Preview D1 database", () => {
  assert.equal(preview.name, "prochelia-api-preview");
  assert.equal(preview.vars?.APP_ENV, "preview");
  assert.equal(preview.d1_databases?.length, 1);
  assert.equal(preview.d1_databases[0].binding, "DB");
  assert.equal(preview.d1_databases[0].database_name, expectedPreviewName);
  assert.equal(preview.d1_databases[0].database_id, expectedPreviewId);
});

test("preview D1 is isolated from the production D1 binding", () => {
  const productionIds = (production.d1_databases || []).map(item => item.database_id);
  assert.ok(!productionIds.includes(expectedPreviewId), "preview must never bind to production D1");
});

test("preview-only dry-run command is explicitly configured", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts["check:worker:preview"], /--dry-run/);
  assert.match(packageJson.scripts["check:worker:preview"], /wrangler\.preview\.jsonc/);
});

test("Cloudflare Workers Builds previews use the same isolated Preview D1", () => {
  const workerPreview = production.previews;
  assert.equal(workerPreview?.vars?.APP_ENV, "preview");
  assert.equal(workerPreview?.d1_databases?.length, 1);
  assert.equal(workerPreview.d1_databases[0].binding, "DB");
  assert.equal(workerPreview.d1_databases[0].database_name, expectedPreviewName);
  assert.equal(workerPreview.d1_databases[0].database_id, expectedPreviewId);
});

test("manual SUPRA Preview deploy gate pins the same D1 identity and cannot target Production", () => {
  assert.match(deployWorkflow, new RegExp(expectedPreviewId));
  assert.match(deployWorkflow, new RegExp(expectedPreviewName));
  assert.match(deployWorkflow, /DEPLOY_PREVIEW_ONLY/);
  assert.match(deployWorkflow, /wrangler\.preview\.jsonc/);
  assert.match(deployWorkflow, /No D1 migrations, no production deployment/);
});
