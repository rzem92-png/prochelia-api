import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/deploy-supra-preview-manual.yml", import.meta.url), "utf8");

test("SUPRA Preview deployment is manual, owner-only and requires exact branch and confirmation", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /refs\/heads\/feat\/supra-intelligence-governance-v1/);
  assert.match(workflow, /github\.actor == 'rzem92-png'/);
  assert.match(workflow, /DEPLOY_PREVIEW_ONLY/);
});

test("SUPRA Preview deployment pins the isolated Preview D1 and refuses production overlap", () => {
  assert.match(workflow, /prochelia-preview-eu-2026-11-17/);
  assert.match(workflow, /e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /Production and preview resources are not isolated/);
  assert.match(workflow, /wrangler deploy --config wrangler\.preview\.jsonc/);
});

test("SUPRA Preview deployment does not apply D1 migrations or deploy Production", () => {
  assert.doesNotMatch(workflow, /d1 migrations apply/);
  assert.match(workflow, /no D1 migrations, no production deployment/i);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/);
});
