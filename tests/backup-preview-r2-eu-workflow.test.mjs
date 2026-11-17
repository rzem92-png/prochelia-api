import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/backup-preview-d1-to-r2-eu.yml", import.meta.url), "utf8");

test("Preview R2 backup is manually gated and pinned to the reviewed EU Preview D1 config", () => {
  assert.match(workflow, /confirm_preview_backup/);
  assert.match(workflow, /BACKUP_PREVIEW_TO_R2_EU/);
  assert.match(workflow, /ref: cf7961db717fc5cb56719c52909ff03acb29bf84/);
  assert.match(workflow, /wrangler\.preview-migrations\.jsonc/);
  assert.match(workflow, /prochelia-preview-eu-2026-11-17/);
  assert.match(workflow, /e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /04f52830-ef5a-4f17-a640-42bbc2381bba/);
});

test("Preview R2 backup verifies both exact resources are EU before export", () => {
  const guard = workflow.indexOf("Verify exact EU R2 bucket and Preview D1 jurisdiction before export");
  const exportStep = workflow.indexOf("Export preview D1 (read-only)");
  assert.ok(guard >= 0 && exportStep > guard);
  assert.match(workflow, /cf-r2-jurisdiction: eu/);
  assert.match(workflow, /\.result\.jurisdiction == "eu"/);
  assert.match(workflow, /\.result\.uuid == \$id and \.result\.name == \$name and \.result\.jurisdiction == "eu"/);
  assert.match(workflow, /prochelia-preview-backups-eu-v2/);
  assert.match(workflow, /f2a79e9fa41566a8ec80fb24c02c60eb\.eu\.r2\.cloudflarestorage\.com/);
});

test("Preview backup is encrypted, round-trip verified and cannot mutate D1 or Production", () => {
  assert.match(workflow, /cipher-algo AES256/);
  assert.match(workflow, /sqlite3 .*PRAGMA integrity_check/);
  assert.match(workflow, /sha256/);
  assert.match(workflow, /Download backup and verify encryption\/checksum/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
  assert.doesNotMatch(workflow, /wrangler@4 deploy/);
});
