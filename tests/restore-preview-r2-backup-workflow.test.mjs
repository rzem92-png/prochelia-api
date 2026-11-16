import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/restore-preview-r2-backup-isolated-test.yml", import.meta.url), "utf8");

test("R2 restore is manual, explicit, and only targets the isolated D1 v2 database", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /RESTORE_PREVIEW_R2_TO_ISOLATED_TEST_ONLY/);
  assert.match(workflow, /RESTORE_DB_NAME: prochelia-restore-test-v2/);
  assert.match(workflow, /RESTORE_DB_ID: a3526c2a-39cb-49ab-97c4-979138145f33/);
  assert.match(workflow, /RESTORE_DB_ID != "\$PRODUCTION_DB_ID"/);
  assert.match(workflow, /RESTORE_DB_ID != "\$PREVIEW_DB_ID"/);
});

test("R2 restore verifies EU bucket, exact account and object prefix before download", () => {
  assert.match(workflow, /prochelia-preview-backups-eu-v2/);
  assert.match(workflow, /cf-r2-jurisdiction: eu/);
  assert.match(workflow, /result\.jurisdiction == "eu"/);
  assert.match(workflow, /preview-d1\/prochelia-preview-db/);
});

test("R2 restore decrypts, checks checksum and tests local SQLite before remote writes", () => {
  assert.match(workflow, /gpg --batch/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /PRAGMA integrity_check/);
  assert.match(workflow, /PRAGMA foreign_key_check/);
  assert.ok(workflow.indexOf("Decrypt, verify checksum") < workflow.indexOf("Restore only into the isolated D1 database"));
});

test("R2 restore requires an empty exact D1 target before write and checks restored schema", () => {
  assert.match(workflow, /Confirm isolated restore database is empty/);
  assert.match(workflow, /pre-restore\.json/);
  assert.match(workflow, /PRAGMA quick_check/);
  assert.match(workflow, /PRAGMA foreign_key_check/);
  assert.match(workflow, /migration_count/);
});

test("R2 restore pins checkout and setup-node actions to immutable SHAs", () => {
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
});
