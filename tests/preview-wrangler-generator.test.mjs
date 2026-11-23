import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const productionId = "04f52830-ef5a-4f17-a640-42bbc2381bba";
const previewId = "e3cf167c-37e1-4d72-9ac6-b3e27c14b97f";

function runGenerator(mutateConfig = (value) => value) {
  const directory = mkdtempSync(join(tmpdir(), "prochelia-preview-config-"));
  try {
    mkdirSync(join(directory, "scripts"), { recursive: true });
    const sourceConfig = readFileSync(join(repoRoot, "wrangler.jsonc"), "utf8");
    writeFileSync(join(directory, "wrangler.jsonc"), mutateConfig(sourceConfig));
    copyFileSync(
      join(repoRoot, "scripts/generate-preview-wrangler-config.mjs"),
      join(directory, "scripts/generate-preview-wrangler-config.mjs")
    );
    const result = spawnSync(
      process.execPath,
      [join(directory, "scripts/generate-preview-wrangler-config.mjs")],
      { cwd: directory, encoding: "utf8" }
    );
    const outputPath = join(directory, "wrangler.preview.generated.json");
    const preview = existsSync(outputPath)
      ? JSON.parse(readFileSync(outputPath, "utf8"))
      : null;
    return { result, preview };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("generated Worker config is isolated, redacts query strings and excludes unverified R2", () => {
  const { result, preview } = runGenerator();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(preview);
  assert.equal(preview.name, "fix-pages-proxy-preview-cors-2026-11-23");
  assert.equal(preview.vars.APP_ENV, "preview");
  assert.equal(preview.d1_databases[0].database_id, previewId);
  assert.equal(preview.previews.d1_databases[0].database_id, previewId);
  assert.equal(JSON.stringify(preview).includes(productionId), false);
  assert.equal(preview.r2_buckets, undefined);
  assert.deepEqual(preview.triggers.crons, []);
  assert.equal(preview.observability.enabled, true);
  assert.equal(preview.observability.redact_query_string, true);
  assert.equal(preview.observability.logs.enabled, true);
  assert.equal(preview.observability.logs.invocation_logs, false);
  assert.equal(preview.observability.traces.enabled, false);
  const origins = preview.vars.CORS_ORIGIN.split(",");
  assert.ok(origins.includes("https://pages-proxy-2026-11-23.prochelia.pages.dev"));
  assert.ok(origins.includes("https://fix-frontend-finance-confirm.prochelia.pages.dev"));
  assert.ok(origins.every((origin) => origin.startsWith("https://") && origin !== "*"));
});

test("generator fails closed if the source Production D1 identity changes", () => {
  const { result, preview } = runGenerator((value) =>
    value.replace(productionId, "00000000-0000-0000-0000-000000000000")
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production D1 identity mismatch/);
  assert.equal(preview, null);
});
