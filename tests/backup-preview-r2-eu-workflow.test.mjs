import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/backup-preview-d1-to-r2-eu.yml", import.meta.url), "utf8");

test("Preview R2 backup is manually gated to main and pinned to the reviewed EU Preview D1 config", () => {
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
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
  assert.match(workflow, /f2a79e9fa41566a8ec80fb24c02c60eb\.eu\.r2\.cloudflarestorage\.com/);
});

test("Preview backup is encrypted, round-trip verified and cannot mutate D1 or Production", () => {
  assert.match(workflow, /cipher-algo AES256/);
  assert.match(workflow, /sqlite3 .*PRAGMA integrity_check/);
  assert.match(workflow, /PRAGMA foreign_key_check/);
  assert.ok(workflow.includes("roundtrip-validation.sqlite"));
  assert.match(workflow, /roundtrip_foreign_keys/);
  assert.match(workflow, /sha256/);
  assert.match(workflow, /Download backup and verify encryption\/checksum/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
  assert.doesNotMatch(workflow, /wrangler@4 deploy/);
});

test("Preview backup token assignments close the command substitution and quoted value", () => {
  const lines = workflow.split("\n").filter(line => line.includes("token=" + String.fromCharCode(34) + "$(printf"));
  assert.equal(lines.length, 2);
  for (const line of lines) assert.ok(line.endsWith(")\""), line);
});

const scheduledWorkflow = await readFile(new URL("../.github/workflows/backup-preview-d1.yml", import.meta.url), "utf8");

test("Scheduled Preview D1 backup checks out the exact workflow commit before reading Wrangler config", () => {
  const checkout = scheduledWorkflow.indexOf("actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09");
  const secretCheck = scheduledWorkflow.indexOf("Vérifier les secrets requis et la cible Cloudflare");
  const exportStep = scheduledWorkflow.indexOf("wrangler@4 d1 export");
  assert.ok(checkout >= 0 && secretCheck > checkout && exportStep > secretCheck);
  assert.match(scheduledWorkflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(scheduledWorkflow, /persist-credentials: false/);
  assert.match(scheduledWorkflow, /wrangler\.preview-migrations\.jsonc/);
});

test("Scheduled Preview backup pins setup-node and remains read-only", () => {
  assert.match(scheduledWorkflow, /actions\/setup-node@[0-9a-f]{40}/);
  assert.doesNotMatch(scheduledWorkflow, /wrangler@4 deploy|d1 migrations apply/);
});
