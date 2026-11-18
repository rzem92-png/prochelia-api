import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/backup-preview-d1-to-r2-eu.yml", import.meta.url), "utf8");

test("Preview R2 backup is manually gated to main or the exact reviewed attestation branch and pinned to the reviewed EU Preview D1 config", () => {
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/fix\/r2-preview-backup-signed-attestation-2026-11-18'/);
  assert.match(workflow, /inputs\.confirm_preview_backup == 'BACKUP_PREVIEW_TO_R2_EU'/);
  assert.match(workflow, /ref: 1fc258c9c8d25e5e7b89241504218bf102afbf27/);
  assert.match(workflow, /clean="\\n"\.join/);
  assert.ok(workflow.includes("grep -Fq \"$EXPECTED_ACCOUNT_ID\""));
  assert.ok(workflow.includes("PASS: Wrangler authenticated to the expected Cloudflare account."));
  assert.match(workflow, /wrangler\.preview-migrations\.jsonc/);
  assert.match(workflow, /prochelia-preview-eu-2026-11-17/);
  assert.match(workflow, /e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /04f52830-ef5a-4f17-a640-42bbc2381bba/);
});

test("Cloudflare token normalization strips actual CR and LF characters without deleting token characters", () => {
  const lines = workflow.split("\n").filter(line => line.includes("tr -d"));
  assert.equal(lines.length, 2);
  const expected = "tr -d '" + String.fromCharCode(92) + "r" + String.fromCharCode(92) + "n'";
  for (const line of lines) assert.ok(line.includes(expected), line);
});

test("Preview R2 backup pins third-party actions to immutable SHAs", () => {
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
});

test("Preview R2 backup verifies both exact resources are EU before export", () => {
  const guard = workflow.indexOf("Verify exact EU R2 bucket and Preview D1 jurisdiction before export");
  const exportStep = workflow.indexOf("Export preview D1 (read-only)");
  assert.ok(guard >= 0 && exportStep > guard);
  assert.match(workflow, /cf-r2-jurisdiction: eu/);
  assert.match(workflow, /\.result\.jurisdiction == "eu"/);
  assert.match(workflow, /\.result\.uuid == \$id and \.result\.name == \$name and \.result\.jurisdiction == "eu"/);
  assert.match(workflow, /prochelia-preview-backups-eu-v2/);
  assert.ok(workflow.includes('(.provenance.ref == "refs/heads/main" or .provenance.ref == "refs/heads/fix/r2-preview-backup-signed-attestation-2026-11-18")'));
  assert.match(workflow, /f2a79e9fa41566a8ec80fb24c02c60eb\.eu\.r2\.cloudflarestorage\.com/);
});

test("Preview R2 backup requires an enabled exact-prefix EU bucket lock meeting owner-approved retention before export", () => {
  assert.ok(workflow.includes("R2_EXPECTED_RETENTION_SECONDS: ${{ vars.R2_EXPECTED_RETENTION_SECONDS }}"));
  const lock = workflow.indexOf("/r2/buckets/$R2_BUCKET/lock");
  const exportStep = workflow.indexOf("Export preview D1 (read-only)");
  assert.ok(lock >= 0 && exportStep > lock);
  assert.ok(workflow.includes("cf-r2-jurisdiction: eu"));
  assert.ok(workflow.includes("preview-d1/${EXPECTED_DB_NAME}/"));
  assert.ok(workflow.includes(".prefix == $prefix"));
  assert.ok(workflow.includes(".condition.maxAgeSeconds >= $retention"));
  assert.ok(workflow.includes("No enabled EU R2 lock rule"));
  assert.ok(workflow.includes("retention duration approved by the data-retention owner"));
});

test("Preview backup is encrypted, round-trip verified and cannot mutate D1 or Production", () => {
  assert.match(workflow, /cipher-algo AES256/);
  assert.match(workflow, /sqlite3 .*PRAGMA integrity_check/);
  assert.match(workflow, /PRAGMA foreign_key_check/);
  assert.ok(workflow.includes("roundtrip-validation.sqlite"));
  assert.match(workflow, /roundtrip_foreign_keys/);
  assert.match(workflow, /sha256/);
  assert.match(workflow, /Download backup and verify HMAC attestation/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
  assert.doesNotMatch(workflow, /wrangler@4 deploy/);
});

test("Preview backup token assignments close the command substitution and quoted value", () => {
  const lines = workflow.split("\n").filter(line => line.includes("token=" + String.fromCharCode(34) + "$(printf"));
  assert.equal(lines.length, 2);
  for (const line of lines) assert.ok(line.endsWith(")\""), line);
});

test("Preview R2 backup requires a separate HMAC attestation key and checks its minimum length", () => {
  assert.match(workflow, /BACKUP_ATTESTATION_HMAC_KEY: \$\{\{ secrets\.BACKUP_ATTESTATION_HMAC_KEY \}\}/);
  assert.match(workflow, /BACKUP_ATTESTATION_HMAC_KEY/);
  assert.match(workflow, /attestation_key_length/);
  assert.match(workflow, /at least 32 UTF-8 bytes/);
});

test("Preview R2 backup stores and verifies the signed manifest beside the encrypted object", () => {
  const prepare = workflow.indexOf("Prepare signed Preview backup attestation");
  const upload = workflow.indexOf("Upload encrypted backup and signed attestation");
  const verify = workflow.indexOf("Download backup and verify HMAC attestation");
  assert.ok(prepare >= 0 && upload > prepare && verify > upload);
  assert.match(workflow, /r2-backup-attestation\.mjs sign/);
  assert.match(workflow, /r2-backup-attestation\.mjs verify/);
  assert.match(workflow, /\.attestation\.json/);
  assert.match(workflow, /\.attestation\.hmac/);
  assert.match(workflow, /ciphertext_sha256/);
  assert.match(workflow, /plaintext_sha256/);
});

test("Preview R2 backup refuses to reuse an object key or reuse the encryption secret for HMAC", () => {
  assert.match(workflow, /BACKUP_ATTESTATION_HMAC_KEY.*BACKUP_ENCRYPTION_KEY/s);
  assert.match(workflow, /aws s3api list-objects-v2/);
  assert.match(workflow, /refusing to overwrite an earlier attestation/);
});

test("Preview R2 attestation summary uses printf and a single grouped append", () => {
  const summary = workflow.slice(workflow.indexOf("Record non-secret backup attestation evidence"));
  assert.ok(summary.includes(`printf 'Preview R2 object: %s\\n' "$R2_OBJECT_KEY"`));
  assert.ok(summary.includes(`printf 'HMAC attestation objects: %s.attestation.json and .attestation.hmac\\n' "$R2_OBJECT_KEY"`));
  assert.ok(summary.includes(`} >> "$GITHUB_STEP_SUMMARY"`));
  assert.doesNotMatch(summary, /echo /);
});
