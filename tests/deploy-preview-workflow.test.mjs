import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/deploy-preview-worker-manual.yml", import.meta.url), "utf8");
const backupWorkflow = await readFile(new URL("../.github/workflows/backup-preview-d1-to-r2-eu.yml", import.meta.url), "utf8");

test("Preview deploy is manual and requires exact confirmation on main", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /DEPLOY_PREVIEW_ONLY/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
});

test("Preview deploy pins isolated Worker and Preview D1, never production", () => {
  assert.match(workflow, /name:\s*'prochelia-api-preview'/);
  assert.match(workflow, /6adb95e5-e542-4bec-9008-fbea01042305/);
  assert.match(workflow, /04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.match(workflow, /preview\.name === production\.name/);
  assert.match(workflow, /keep_vars:\s*true/);
  assert.match(workflow, /r2_buckets:\s*\[\{/);
  assert.match(workflow, /binding:\s*'BACKUP_BUCKET'/);
  assert.match(workflow, /https:\/\/83a36d32\.prochelia\.pages\.dev/);
  assert.match(workflow, /bucket_name:\s*'prochelia-preview-backups-eu-locked'/);
  assert.match(workflow, /Verify dedicated Preview R2 bucket has EU jurisdiction/);
  assert.match(workflow, /cf-r2-jurisdiction: eu/);
  assert.match(workflow, /jurisdiction == "eu"/);
});

test("Preview deploy runs the complete security suite and dry-run before the only deployment command", () => {
  const tests = workflow.indexOf("Run backend contract and complete security regression suite");
  const dryRun = workflow.indexOf("Validate Wrangler bundle without deployment");
  const deploy = workflow.indexOf("Deploy ONLY the isolated Preview Worker");
  assert.ok(tests >= 0 && dryRun > tests && deploy > dryRun);
  assert.match(workflow, /tests\/directory-api\.test\.js/);
  assert.match(workflow, /tests\/bootstrap-atomic\.test\.js/);
  assert.match(workflow, /--dry-run/);
  assert.match(workflow, /wrangler@4 deploy --config wrangler\.preview\.generated\.json --keep-vars/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
});

test("checkout and Node setup actions are pinned to immutable SHAs", () => {
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
});


test("Preview backup verifies the exact D1 identity and explicit EU jurisdiction before exporting", () => {
  const guard = backupWorkflow.indexOf("Verify Preview D1 EU jurisdiction before any export");
  const exportStep = backupWorkflow.indexOf("Export preview D1 (read-only)");
  assert.ok(guard >= 0 && exportStep > guard, "D1 jurisdiction guard must precede export");
  assert.match(backupWorkflow, /\/d1\/database\/\$EXPECTED_DB_ID/);
  assert.match(backupWorkflow, /\.result\.uuid == \$id/);
  assert.match(backupWorkflow, /\.result\.name == \$name/);
  assert.match(backupWorkflow, /\.result\.jurisdiction == "eu"/);
  assert.match(backupWorkflow, /refusing export and backup/);
});
