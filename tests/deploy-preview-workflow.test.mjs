import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workflow = await readFile(new URL("../.github/workflows/deploy-preview-worker-manual.yml", import.meta.url), "utf8");
const generator = await readFile(new URL("../scripts/generate-preview-wrangler-config.mjs", import.meta.url), "utf8");

test("Preview deploy is manual and requires exact confirmation on main", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /DEPLOY_PREVIEW_ONLY/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
});

test("Preview deploy pins isolated Worker and Preview D1, never production", () => {
  assert.match(generator, /name:\s*"prochelia-api-preview"/);
  assert.match(generator, /e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(generator, /04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.match(generator, /preview\.name === production\.name/);
  assert.match(generator, /APP_ENV:\s*"preview"/);
  assert.doesNotMatch(workflow, /keep_vars|--keep-vars/);
  assert.match(generator, /r2_buckets:\s*\[\{/);
  assert.match(generator, /binding:\s*"BACKUP_BUCKET"/);
  assert.match(generator, /https:\/\/83a36d32\.prochelia\.pages\.dev/);
  assert.match(generator, /bucket_name:\s*"prochelia-preview-backups-eu-v2"/);
  assert.match(generator, /jurisdiction:\s*"eu"/);
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
  assert.match(workflow, /wrangler@4 deploy --config wrangler\.preview\.generated\.json/);
  assert.match(workflow, /node scripts\/generate-preview-wrangler-config\.mjs/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
});

test("checkout and Node setup actions are pinned to immutable SHAs", () => {
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
});

test("Preview deployment config generator emits only isolated EU Preview bindings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prochelia-preview-config-"));
  try {
    await writeFile(join(directory, "wrangler.jsonc"), JSON.stringify({
      name: "prochelia-api",
      d1_databases: [{ binding: "DB", database_id: "04f52830-ef5a-4f17-a640-42bbc2381bba" }]
    }));
    const script = fileURLToPath(new URL("../scripts/generate-preview-wrangler-config.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const generated = JSON.parse(await readFile(join(directory, "wrangler.preview.generated.json"), "utf8"));
    assert.equal(generated.name, "prochelia-api-preview");
    assert.equal(generated.vars.APP_ENV, "preview");
    assert.equal(generated.d1_databases[0].database_id, "e3cf167c-37e1-4d72-9ac6-b3e27c14b97f");
    assert.equal(generated.r2_buckets[0].jurisdiction, "eu");
    assert.notEqual(generated.d1_databases[0].database_id, "04f52830-ef5a-4f17-a640-42bbc2381bba");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
