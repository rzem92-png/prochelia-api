import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/restore-preview-r2-backup-isolated-test.yml", import.meta.url), "utf8");
const backupWorkflow = await readFile(new URL("../.github/workflows/backup-preview-d1-to-r2-eu.yml", import.meta.url), "utf8");

test("Preview R2 restore is manually gated to main or the dedicated isolated-restore branch", () => {
  assert.ok(workflow.includes("github.ref == 'refs/heads/main'"));
  assert.ok(workflow.includes("github.ref == 'refs/heads/fix/restore-preview-fresh-eu-d1-2026-11-18'"));
  assert.ok(workflow.includes("refs/heads/main|refs/heads/fix/restore-preview-fresh-eu-d1-2026-11-18"));
  assert.ok(workflow.includes("RESTORE_PREVIEW_R2_TO_ISOLATED_TEST_ONLY"));
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
  assert.match(workflow, /RESTORE_DB_ID: 6b9a2659-53b7-499a-a53c-eeae64166508/);
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

test("Restore target is the newly provisioned empty EU-only validation database", () => {
  assert.match(workflow, /RESTORE_DB_NAME: prochelia-r2-restore-validation-2026-11-18/);
  assert.match(workflow, /RESTORE_DB_ID: 6b9a2659-53b7-499a-a53c-eeae64166508/);
  assert.doesNotMatch(workflow, /3caebbc6-982a-4562-96a7-e509185e9e9a/);
  assert.match(workflow, /RESTORE_DB_ID.*!=.*PREVIEW_DB_ID/);
  assert.match(workflow, /RESTORE_DB_ID.*!=.*PRODUCTION_DB_ID/);
  assert.match(workflow, /Confirm isolated restore database is empty before any remote write/);
});

test("Restore requires and verifies the HMAC attestation before decrypting or writing D1", () => {
  assert.match(workflow, /BACKUP_ATTESTATION_HMAC_KEY: \$\{\{ secrets\.BACKUP_ATTESTATION_HMAC_KEY \}\}/);
  assert.match(workflow, /BACKUP_ATTESTATION_HMAC_KEY.*32 UTF-8 bytes/s);
  assert.match(workflow, /\.attestation\.json/);
  assert.match(workflow, /\.attestation\.hmac/);
  const verify = workflow.indexOf("Verify HMAC attestation and exact Preview source before decryption");
  const decrypt = workflow.indexOf("Decrypt, verify checksum and test local SQLite restoration");
  const remoteWrite = workflow.indexOf("Restore only into the isolated D1 database");
  assert.ok(verify >= 0 && decrypt > verify && remoteWrite > decrypt);
  assert.match(workflow, /r2-backup-attestation\.mjs verify/);
  assert.match(workflow, /cipher_expected/);
  assert.match(workflow, /attested_plain/);
});

test("Restore refuses to reuse the encryption secret as the HMAC attestation key", () => {
  assert.match(workflow, /BACKUP_ATTESTATION_HMAC_KEY.*BACKUP_ENCRYPTION_KEY/s);
});
test("HMAC restore can be manually dispatched from its reviewed attestation branch", () => {
  assert.ok(workflow.includes("github.ref == 'refs/heads/fix/r2-preview-backup-signed-attestation-2026-11-18'"));
  assert.ok(workflow.includes("refs/heads/fix/r2-preview-backup-signed-attestation-2026-11-18) ;;"));
  assert.match(workflow, /RESTORE_DB_ID.*!=.*PRODUCTION_DB_ID/);
  assert.match(workflow, /Confirm isolated restore database is empty before any remote write/);
});


test("Signed Preview backup is manually dispatchable from the dedicated reviewed attestation branch", () => {
  assert.match(backupWorkflow, /workflow_dispatch:/);
  assert.ok(backupWorkflow.includes("github.ref == 'refs/heads/main'"));
  assert.ok(backupWorkflow.includes("github.ref == 'refs/heads/fix/r2-preview-backup-signed-attestation-2026-11-18'"));
  assert.ok(backupWorkflow.includes("refs/heads/main|refs/heads/fix/r2-preview-backup-signed-attestation-2026-11-18"));
  assert.ok(backupWorkflow.includes("BACKUP_PREVIEW_TO_R2_EU"));
  assert.match(backupWorkflow, /BACKUP_ATTESTATION_HMAC_KEY: \$\{\{ secrets\.BACKUP_ATTESTATION_HMAC_KEY \}\}/);
  assert.match(backupWorkflow, /EXPECTED_DB_ID: e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(backupWorkflow, /R2_BUCKET: prochelia-preview-backups-eu-v2/);
  assert.match(backupWorkflow, /result\.jurisdiction == "eu"/);
});

test("Isolated restore accepts only the exact signed backup provenance branches", () => {
  assert.match(workflow, /\.provenance\.ref == "refs\/heads\/main" or \.provenance\.ref == "refs\/heads\/fix\/r2-preview-backup-signed-attestation-2026-11-18"/);
  assert.match(workflow, /r2-backup-attestation\.mjs verify/);
});
