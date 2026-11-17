import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/restore-preview-r2-backup-isolated-test.yml", import.meta.url), "utf8");

test("Preview R2 restore is manually gated to the reviewed main branch", () => {
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /RESTORE_PREVIEW_R2_TO_ISOLATED_TEST_ONLY/);
});

test("Restore source is pinned to the new EU Preview D1 and matching R2 object prefix", () => {
  assert.match(workflow, /SOURCE_DB_NAME: prochelia-preview-eu-2026-11-17/);
  assert.match(workflow, /PREVIEW_DB_ID: e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /preview-d1\/prochelia-preview-eu-2026-11-17/);
  assert.doesNotMatch(workflow, /prochelia-preview-db|6adb95e5-e542-4bec-9008-fbea01042305/);
});

test("Both source and isolated restore D1 identities and EU jurisdictions are checked", () => {
  assert.match(workflow, /source-d1\.json/);
  assert.match(workflow, /restore-d1\.json/);
  assert.match(workflow, /result\.jurisdiction == "eu"/);
  assert.match(workflow, /RESTORE_DB_ID: 3caebbc6-982a-4562-96a7-e509185e9e9a/);
  assert.match(workflow, /RESTORE_DB_ID.*!=.*PRODUCTION_DB_ID/);
  assert.match(workflow, /RESTORE_DB_ID.*!=.*PREVIEW_DB_ID/);
});

test("Restore validates encryption, checksum and SQLite integrity before remote writes", () => {
  assert.match(workflow, /gpg --batch/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /PRAGMA integrity_check/);
  assert.match(workflow, /PRAGMA foreign_key_check/);
  assert.ok(workflow.indexOf("Decrypt, verify checksum and test local SQLite restoration") < workflow.indexOf("Restore only into the isolated D1 database"));
});

test("Isolated restore target must be empty and is checked after restoration", () => {
  assert.match(workflow, /Confirm isolated restore database is empty before any remote write/);
  assert.match(workflow, /pre-restore\.json/);
  assert.match(workflow, /PRAGMA quick_check/);
  assert.match(workflow, /migration_count/);
});

test("Restore workflow pins third-party actions and restricts the generated object key format", () => {
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  assert.match(workflow, /\[0-9\]\{4\}\/\[0-9\]\{2\}\/\[0-9\]\{2\}/);
});
