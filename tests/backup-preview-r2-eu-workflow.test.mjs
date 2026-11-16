import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/backup-preview-d1-to-r2-eu.yml", import.meta.url), "utf8");

test("Preview backup secrets are available only from the reviewed main workflow dispatch", () => {
  assert.match(workflow, /if: \$\{\{ github\.ref == 'refs\/heads\/main' && inputs\.confirm_preview_backup == 'BACKUP_PREVIEW_TO_R2_EU' \}\}/);
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.doesNotMatch(workflow, /refs\/heads\/fix\/preview-backup-r2-v2-jurisdiction-guard-2026-11-16/);
});

test("Preview backup targets only the dedicated v2 EU-jurisdiction bucket", () => {
  assert.match(workflow, /R2_BUCKET: prochelia-preview-backups-eu-v2/);
  assert.match(workflow, /R2_ENDPOINT: https:\/\/f2a79e9fa41566a8ec80fb24c02c60eb\.eu\.r2\.cloudflarestorage\.com/);
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

test("Backup restore validation checks SQLite integrity and foreign keys before upload and after R2 round-trip", () => {
  assert.match(workflow, /PRAGMA integrity_check/);
  assert.match(workflow, /PRAGMA foreign_key_check/);
  assert.match(workflow, /roundtrip-validation\.sqlite/);
  assert.match(workflow, /roundtrip_foreign_keys/);
});

test("Backup workflow pins third-party checkout and Node setup actions to immutable SHAs", () => {
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
});

test("Backup workflow permits only main, the existing dedicated backup branch, and this guarded EU v2 review branch", () => {
  assert.match(workflow, /refs\/heads\/main\|refs\/heads\/prelaunch\/r2-eu-backup-workflow\|refs\/heads\/fix\/preview-backup-r2-v2-jurisdiction-guard-2026-11-16/);
});
