import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/provision-preview-r2-eu.yml", import.meta.url), "utf8");
const backupWorkflow = await readFile(new URL("../.github/workflows/backup-preview-d1-to-r2-eu.yml", import.meta.url), "utf8");
const restoreWorkflow = await readFile(new URL("../.github/workflows/restore-preview-r2-backup-isolated-test.yml", import.meta.url), "utf8");

test("R2 provisioning is manually gated to its dedicated branch and exact Preview-only confirmation", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.ok(workflow.includes("refs/heads/fix/r2-backup-attestation-branch-gated-2026-11-23"));
  assert.match(workflow, /CREATE_PREVIEW_R2_EU_ONLY/);
  assert.ok(workflow.includes("github.actor == 'rzem92-png'"));
  assert.ok(workflow.includes('test "$GITHUB_ACTOR" = "rzem92-png"'));
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/);
});

test("R2 provisioning creates the exact bucket consumed by backup and restore workflows", () => {
  assert.match(backupWorkflow, /R2_BUCKET: prochelia-preview-backups-eu-v2/);
  assert.match(restoreWorkflow, /R2_BUCKET: prochelia-preview-backups-eu-v2/);
  assert.match(workflow, /BUCKET="prochelia-preview-backups-eu-v2"/);
  assert.match(workflow, /prochelia-preview-backups-eu-v2/);
  assert.match(workflow, /r2 bucket create "\$BUCKET" --jurisdiction eu(?! --location)/);
  assert.match(workflow, /cf-r2-jurisdiction: eu/);
  assert.match(workflow, /\.result\.jurisdiction == "eu"/);
  assert.match(workflow, /The dedicated EU bucket already exists/);
});

test("R2 provisioning never deploys, migrates, or changes Production", () => {
  assert.doesNotMatch(workflow, /wrangler@4 deploy/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
  assert.doesNotMatch(workflow, /workers\/scripts\/prochelia-api(?!-preview)/);
  assert.match(workflow, /No Worker deployment, D1 migration, Production change/);
});

test("Third-party GitHub actions are pinned to immutable commit SHAs", () => {
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
});
