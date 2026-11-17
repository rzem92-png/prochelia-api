import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/provision-preview-r2-eu.yml", import.meta.url), "utf8");

test("R2 provisioning is manually gated to its dedicated branch and exact Preview-only confirmation", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /refs\/heads\/fix\/provision-r2-preview-eu-2026-11-17/);
  assert.match(workflow, /inputs\.confirmation == 'CREATE_PREVIEW_R2_EU_ONLY'/);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/);
});

test("R2 provisioning targets only the expected bucket and explicitly requests EU jurisdiction", () => {
  assert.ok(workflow.includes("prochelia-preview-backups-eu-v2"));
  assert.ok(workflow.includes("cf-r2-jurisdiction: eu"));
  assert.ok(workflow.includes('"locationHint":"eeur"'));
  assert.ok(workflow.includes('.result.jurisdiction == "eu"'));
  assert.match(workflow, /location hint is best-effort/);
});

test("R2 provisioning creates only after an explicit 404 and fails closed on other lookup errors", () => {
  assert.ok(workflow.includes('if [ "$status" = "404" ]'));
  assert.match(workflow, /EU bucket lookup failed/);
  assert.match(workflow, /no create attempted/);
  assert.match(workflow, /Existing bucket metadata is not explicitly EU/);
});

test("R2 provisioning never deploys, migrates, or changes Production", () => {
  assert.doesNotMatch(workflow, /wrangler@4 deploy/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
  assert.doesNotMatch(workflow, /workers\/scripts\/prochelia-api(?!-preview)/);
  assert.match(workflow, /No Worker deployment, D1 migration, Production change/);
});

test("R2 provisioning uses no floating third-party GitHub actions", () => {
  assert.ok(!workflow.includes("uses:"));
});
