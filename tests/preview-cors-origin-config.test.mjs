import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")
);
const deployWorkflow = readFileSync(new URL("../.github/workflows/deploy-pages-proxy-preview.yml", import.meta.url), "utf8");

test("Worker Preview uses the dedicated Preview D1, never the Production D1", () => {
  const productionDb = config.d1_databases.find((item) => item.binding === "DB");
  const previewDb = config.previews.d1_databases.find((item) => item.binding === "DB");

  assert.equal(productionDb.database_id, "04f52830-ef5a-4f17-a640-42bbc2381bba");
  assert.equal(previewDb.database_id, "e3cf167c-37e1-4d72-9ac6-b3e27c14b97f");
  assert.notEqual(previewDb.database_id, productionDb.database_id);
});

test("Pages proxy origin is allowlisted only in the Worker Previews block", () => {
  assert.equal(typeof config.previews.vars.CORS_ORIGIN, "string");
  const origins = config.previews.vars.CORS_ORIGIN.split(",").map((value) => value.trim());

  assert.equal(config.previews.vars.APP_ENV, "preview");
  assert.ok(origins.includes("https://pages-proxy-2026-11-23.prochelia.pages.dev"));
  assert.ok(origins.includes("https://fix-frontend-finance-confirm.prochelia.pages.dev"));
  assert.ok(origins.every((origin) => origin.startsWith("https://")));
  assert.ok(!origins.includes("*"));
  assert.equal(config.vars, undefined);
});

test("Preview configuration does not add Production cron triggers", () => {
  assert.equal(config.previews.triggers, undefined);
  assert.deepEqual(config.triggers.crons, ["*/1 * * * *"]);
});

test("isolated Preview deploy uses the single owner-gated generator", () => {
  assert.match(deployWorkflow, /scripts\/generate-preview-wrangler-config\.mjs/);
  assert.match(deployWorkflow, /tests\/preview-wrangler-generator\.test\.mjs/);
  assert.match(deployWorkflow, /github\.actor == 'rzem92-png'/);
  assert.match(deployWorkflow, /PREVIEW_WRANGLER_CONFIG/);
  assert.match(deployWorkflow, /wrangler@4 deploy --dry-run --config "\$PREVIEW_WRANGLER_CONFIG"/);
  assert.match(deployWorkflow, /wrangler@4 deploy --config "\$PREVIEW_WRANGLER_CONFIG"/);
  assert.match(deployWorkflow, /PREVIEW_WORKER_URL: https:\/\/fix-pages-proxy-preview-cors-2026-11-23\.rzem92\.workers\.dev/);
  assert.match(deployWorkflow, /e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(deployWorkflow, /04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.doesNotMatch(deployWorkflow, /wrangler@4 preview --config/);
  assert.doesNotMatch(deployWorkflow, /wrangler@4 preview --name/);
});
