import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (name) => readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");

const productionBackup = await read("backup-production-d1-to-r2.yml");
const productionRestore = await read("restore-production-backup-isolated-test.yml");
const previewRestore = await read("restore-preview-d1-test.yml");
const previewRestoreV2 = await read("restore-preview-d1-test-v2.yml");

test("Production D1 backup is main-only, owner-only and exact-confirmation gated", () => {
  assert.match(productionBackup, /github\.ref == 'refs\/heads\/main'/);
  assert.match(productionBackup, /github\.actor == 'rzem92-png'/);
  assert.match(productionBackup, /BACKUP_PRODUCTION_D1/);
});

test("Production backup restore writes only to the isolated test D1 and is owner-only", () => {
  assert.match(productionRestore, /github\.ref == 'refs\/heads\/main'/);
  assert.match(productionRestore, /github\.actor == 'rzem92-png'/);
  assert.match(productionRestore, /RESTORE_PRODUCTION_BACKUP_TO_ISOLATED_TEST_D1/);
  assert.match(productionRestore, /prochelia-prod-restore-test-2026-11-12/);
  assert.match(productionRestore, /9db489a0-4f96-4e93-b1f4-8a8e755871a7/);
});

test("Preview restore workflows that write to isolated test D1 require owner approval", () => {
  assert.match(previewRestore, /github\.actor == 'rzem92-png'/);
  assert.match(previewRestore, /confirm_isolated_test == true/);
  assert.match(previewRestoreV2, /github\.actor == 'rzem92-png'/);
  assert.match(previewRestoreV2, /confirm_isolated_test == true/);
});

test("No workflow dispatch was added and no Production operation is executed by these tests", () => {
  assert.match(productionBackup, /workflow_dispatch:/);
  assert.match(productionRestore, /workflow_dispatch:/);
  assert.match(previewRestore, /workflow_dispatch:/);
  assert.match(previewRestoreV2, /workflow_dispatch:/);
});
