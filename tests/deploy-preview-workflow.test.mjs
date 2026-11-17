import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workflow = await readFile(new URL("../.github/workflows/deploy-preview-worker-manual.yml", import.meta.url), "utf8");
const workerBuild = await readFile(new URL("../.github/workflows/worker-build-validation.yml", import.meta.url), "utf8");
const generator = await readFile(new URL("../scripts/generate-preview-wrangler-config.mjs", import.meta.url), "utf8");

test("Preview deploy is manual and requires exact confirmation on main or its dedicated PR branch", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /DEPLOY_PREVIEW_ONLY/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/fix\/preview-e2e-dynamic-pages-pin-2026-11-17'/);
});

test("Preview deployment resolves the latest successful Pages Preview before generating Worker config", () => {
  const resolve = workflow.indexOf("Resolve and verify latest Pages Preview origin before generating Worker config");
  const generate = workflow.indexOf("Generate isolated Preview deployment config");
  const deploy = workflow.indexOf("Deploy ONLY the isolated Preview Worker");
  assert.ok(resolve >= 0 && generate > resolve && deploy > generate);
  assert.match(workflow, /pages\/projects\/prochelia\/deployments\?env=preview&per_page=1&page=1/);
  assert.match(workflow, /deployment_configs\.preview\.d1_databases\.DB\.id/);
  assert.match(workflow, /deployment_configs\.preview\.services\.PROCHELIA_API\.service/);
  assert.match(workflow, /\.result\.latest_stage\.status == "success"/);
  assert.match(workflow, /\.result\.uses_functions == true/);
  assert.match(workflow, /--arg expected "\$PAGES_EXPECTED_COMMIT"/);
  assert.match(workflow, /\(\$expected == "" or \.result\.deployment_trigger\.metadata\.commit_hash == \$expected\)/);
  assert.match(workflow, /PAGES_PREVIEW_ORIGIN=/);
  assert.match(workflow, /pages_alias=/);
  assert.match(workflow, /PAGES_PREVIEW_ALIAS=/);
  assert.doesNotMatch(workflow, /579679da7ca3a68b91448a85e7151bda5794a155/);
});

test("Preview deployment resolves the current Pages commit by default and accepts an optional exact SHA", () => {
  assert.match(workflow, /pages_commit_sha:/);
  assert.match(workflow, /PAGES_EXPECTED_COMMIT: \$\{\{ inputs\.pages_commit_sha \|\| '' \}\}/);
  assert.match(workflow, /pages_commit_sha must be an exact 40-character lowercase Git SHA/);
  assert.ok(workflow.includes('[[ -n "$PAGES_EXPECTED_COMMIT" && ! "$PAGES_EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]]'));
});

test("Preview deploy pins isolated Worker and Preview D1, never Production", () => {
  assert.match(generator, /name:\s*"prochelia-api-preview"/);
  assert.match(generator, /e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(generator, /04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.match(generator, /preview\.name === production\.name/);
  assert.match(generator, /APP_ENV:\s*"preview"/);
  assert.doesNotMatch(workflow, /keep_vars|--keep-vars/);
  assert.match(generator, /r2_buckets:\s*\[\{/);
  assert.match(generator, /binding:\s*"BACKUP_BUCKET"/);
  assert.match(generator, /PAGES_PREVIEW_ORIGIN/);
  assert.match(generator, /PAGES_PREVIEW_ALIAS/);
  assert.match(generator, /pagesPreviewAlias/);
  assert.match(generator, /https:\/\/83a36d32\.prochelia\.pages\.dev/);
  assert.match(generator, /https:\/\/6c01ea4a\.prochelia\.pages\.dev/);
  assert.match(generator, /bucket_name:\s*"prochelia-preview-backups-eu-v2"/);
  assert.match(generator, /jurisdiction:\s*"eu"/);
  assert.match(workflow, /Verify dedicated Preview R2 bucket has EU jurisdiction/);
  assert.match(workflow, /cf-r2-jurisdiction: eu/);
  assert.match(workflow, /jurisdiction == "eu"/);
});

test("Worker build CI uses a non-deploying origin sentinel and never publishes the generated Preview config", () => {
  assert.match(workerBuild, /PAGES_PREVIEW_ORIGIN: https:\/\/dry-run-validation\.prochelia\.pages\.dev/);
  assert.match(workerBuild, /wrangler@4 deploy --dry-run --config wrangler\.preview\.generated\.json/);
  assert.doesNotMatch(workerBuild, /wrangler@4 deploy --config wrangler\.preview\.generated\.json/);
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

test("Preview deployment config generator emits isolated EU bindings and the verified Pages origin", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prochelia-preview-config-"));
  const pagesOrigin = "https://8480de7b.prochelia.pages.dev";
  const pagesAlias = "https://fix-frontend-cookie-session-7y26.prochelia.pages.dev";
  try {
    await writeFile(join(directory, "wrangler.jsonc"), JSON.stringify({
      name: "prochelia-api",
      d1_databases: [{ binding: "DB", database_id: "04f52830-ef5a-4f17-a640-42bbc2381bba" }]
    }));
    const script = fileURLToPath(new URL("../scripts/generate-preview-wrangler-config.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script], {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, PAGES_PREVIEW_ORIGIN: pagesOrigin, PAGES_PREVIEW_ALIAS: pagesAlias }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const generated = JSON.parse(await readFile(join(directory, "wrangler.preview.generated.json"), "utf8"));
    assert.equal(generated.name, "prochelia-api-preview");
    assert.equal(generated.vars.APP_ENV, "preview");
    assert.equal(generated.d1_databases[0].database_id, "e3cf167c-37e1-4d72-9ac6-b3e27c14b97f");
    assert.equal(generated.r2_buckets[0].jurisdiction, "eu");
    assert.ok(generated.vars.CORS_ORIGIN.split(",").includes(pagesOrigin));
    assert.ok(generated.vars.CORS_ORIGIN.split(",").includes(pagesAlias));
    assert.notEqual(generated.d1_databases[0].database_id, "04f52830-ef5a-4f17-a640-42bbc2381bba");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Preview deployment config generator refuses a missing or non-Pages origin", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prochelia-preview-invalid-origin-"));
  try {
    await writeFile(join(directory, "wrangler.jsonc"), JSON.stringify({
      name: "prochelia-api",
      d1_databases: [{ binding: "DB", database_id: "04f52830-ef5a-4f17-a640-42bbc2381bba" }]
    }));
    const script = fileURLToPath(new URL("../scripts/generate-preview-wrangler-config.mjs", import.meta.url));
    for (const origin of [undefined, "http://9b529a78.prochelia.pages.dev", "https://example.com", "https://9b529a78.prochelia.pages.dev/path"]) {
      const env = { ...process.env };
      delete env.PAGES_PREVIEW_ORIGIN;
      if (origin !== undefined) env.PAGES_PREVIEW_ORIGIN = origin;
      const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8", env });
      assert.notEqual(result.status, 0, `unexpectedly accepted origin: ${origin}`);
    }
    for (const alias of ["http://fix-frontend-cookie-session-7y26.prochelia.pages.dev", "https://example.com", "https://fix-frontend-cookie-session-7y26.prochelia.pages.dev/path"]) {
      const result = spawnSync(process.execPath, [script], {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, PAGES_PREVIEW_ORIGIN: "https://8480de7b.prochelia.pages.dev", PAGES_PREVIEW_ALIAS: alias }
      });
      assert.notEqual(result.status, 0, `unexpectedly accepted alias: ${alias}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
