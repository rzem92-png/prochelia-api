import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/backup-preview-d1.yml", import.meta.url), "utf8");
const previewConfig = await readFile(new URL("../wrangler.preview-migrations.jsonc", import.meta.url), "utf8");

test("scheduled Preview D1 artifact backup checks out the repository before Wrangler reads its config", () => {
  const checkout = workflow.indexOf("actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09");
  const exportStep = workflow.indexOf("wrangler@4 d1 export");
  assert.ok(checkout >= 0, "checkout must be pinned to an immutable action SHA");
  assert.ok(exportStep > checkout, "checkout must precede the Wrangler D1 export");
  assert.ok(workflow.includes("actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444"));
});

test("scheduled backup remains pinned to the exact EU Preview D1 and migration-only config", () => {
  assert.match(workflow, /DB_NAME: prochelia-preview-eu-2026-11-17/);
  assert.match(workflow, /DB_ID: e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /wrangler\.preview-migrations\.jsonc/);
  assert.match(previewConfig, /"database_name": "prochelia-preview-eu-2026-11-17"/);
  assert.match(previewConfig, /"database_id": "e3cf167c-37e1-4d72-9ac6-b3e27c14b97f"/);
  assert.match(previewConfig, /"migrations_dir": "migrations-preview-canonical"/);
  assert.match(workflow, /retention-days: 7/);
  assert.doesNotMatch(workflow, /wrangler@4 d1 migrations apply|wrangler@4 deploy/);
});
