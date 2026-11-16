import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/backup-preview-d1-to-r2-eu.yml", import.meta.url), "utf8");

test("Preview backup targets only the dedicated v2 EU-jurisdiction bucket", () => {
  assert.match(workflow, /R2_BUCKET: prochelia-preview-backups-eu-v2/);
  assert.match(workflow, /prochelia-preview-backups-eu-v2/);
  assert.match(workflow, /cf-r2-jurisdiction: eu/);
  assert.match(workflow, /\.result\.jurisdiction == "eu"/);
});

test("Preview backup verifies destination jurisdiction before exporting or uploading data", () => {
  const guard = workflow.indexOf("Verify dedicated Preview R2 bucket EU jurisdiction before backup");
  const exportStep = workflow.indexOf("Export preview D1");
  const uploadStep = workflow.indexOf("aws s3 cp");
  assert.ok(guard >= 0 && exportStep > guard && uploadStep > guard);
});

test("Preview backup remains pinned to Preview D1 and never deploys or migrates Production", () => {
  assert.match(workflow, /EXPECTED_DB_ID: 6adb95e5-e542-4bec-9008-fbea01042305/);
  assert.doesNotMatch(workflow, /wrangler@4 deploy/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
});
