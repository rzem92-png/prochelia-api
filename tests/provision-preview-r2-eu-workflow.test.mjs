import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/provision-preview-r2-eu.yml", import.meta.url), "utf8");

test("R2 bucket verification is manually gated to its dedicated branch and exact Preview-only confirmation", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /refs\/heads\/fix\/preview-r2-bucket-consistency-2026-11-19/);
  assert.match(workflow, /VERIFY_PREVIEW_R2_EU_ONLY/);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/);
});

test("R2 verification targets the canonical backup/restore bucket with explicit EU jurisdiction", () => {
  assert.match(workflow, /prochelia-preview-backups-eu-v2/);
  assert.doesNotMatch(workflow, /prochelia-preview-backups-eu-locked/);
  assert.doesNotMatch(workflow, /r2 bucket create/);
  assert.match(workflow, /refusing to create a parallel resource/);
  assert.match(workflow, /cf-r2-jurisdiction: eu/);
  assert.match(workflow, /\.result\.jurisdiction == "eu"/);
  assert.match(workflow, /The dedicated EU bucket already exists/);
});

test("R2 verification never deploys, migrates, or changes Production", () => {
  assert.doesNotMatch(workflow, /wrangler@4 deploy/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
  assert.doesNotMatch(workflow, /workers\/scripts\/prochelia-api(?!-preview)/);
  assert.match(workflow, /No Worker deployment, D1 migration, Production change/);
});

test("Third-party GitHub actions are pinned to immutable commit SHAs", () => {
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
});
