import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/provision-preview-r2-eu.yml", import.meta.url), "utf8");

test("R2 provisioning is manually gated to its dedicated branch and exact Preview-only confirmation", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /refs\/heads\/ops\/provision-preview-r2-eu-jurisdiction-2026-11-16/);
  assert.match(workflow, /CREATE_PREVIEW_R2_EU_ONLY/);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/);
});

test("R2 provisioning creates a new bucket with explicit EU jurisdiction and verifies Cloudflare response", () => {
  assert.match(workflow, /prochelia-preview-backups-eu-locked/);
  assert.match(workflow, /r2 bucket create "\$BUCKET" --jurisdiction eu --location weur/);
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
