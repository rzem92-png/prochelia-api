import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/backup-preview-d1.yml", import.meta.url), "utf8");
const v7Workflow = readFileSync(new URL("../.github/workflows/v7-security-tests.yml", import.meta.url), "utf8");
const configText = readFileSync(new URL("../wrangler.preview-migrations.jsonc", import.meta.url), "utf8");
const config = JSON.parse(configText
  .split("\n")
  .filter(line => !line.trimStart().startsWith("//"))
  .join("\n"));

test("scheduled Preview backup runs only from main and checks out its exact immutable workflow commit", () => {
  assert.ok(workflow.includes("if: github.ref == 'refs/heads/main'"));
  assert.ok(workflow.includes("actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09"));
  assert.ok(workflow.includes("ref: ${{ github.sha }}"));
  assert.ok(workflow.includes("persist-credentials: false"));
});

test("scheduled backup rejects the Production D1 and pins the migration-only config to the exact EU Preview D1", () => {
  assert.ok(workflow.includes("DB_NAME: prochelia-preview-eu-2026-11-17"));
  assert.ok(workflow.includes("DB_ID: e3cf167c-37e1-4d72-9ac6-b3e27c14b97f"));
  assert.ok(workflow.includes("FORBIDDEN_PRODUCTION_DB_ID: 04f52830-ef5a-4f17-a640-42bbc2381bba"));
  assert.ok(workflow.includes('"$DB_ID" == "$FORBIDDEN_PRODUCTION_DB_ID"'));
  assert.deepEqual(config.d1_databases, [{
    binding: "PREVIEW_DB",
    database_name: "prochelia-preview-eu-2026-11-17",
    database_id: "e3cf167c-37e1-4d72-9ac6-b3e27c14b97f",
    migrations_dir: "migrations-preview-canonical"
  }]);
  const checkout = workflow.indexOf("Checkout repository sources");
  const configCheck = workflow.indexOf("Verify migration-only Wrangler config");
  const exportStep = workflow.indexOf("wrangler@4 d1 export");
  assert.ok(checkout >= 0 && configCheck > checkout && exportStep > configCheck);
  assert.ok(!workflow.includes("wrangler@4 deploy"));
  assert.ok(!workflow.includes("d1 migrations apply"));
});

test("scheduled artifact contains only an AES-256 encrypted export with bounded seven-day retention", () => {
  assert.ok(workflow.includes("--cipher-algo AES256"));
  assert.ok(workflow.includes("sha256sum"));
  assert.ok(workflow.includes("--decrypt"));
  assert.ok(workflow.includes("retention-days: 7"));
  assert.ok(workflow.includes("actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f"));
  assert.ok(!workflow.includes("actions/upload-artifact@v6"));
  const pathStart = workflow.indexOf("          path: |");
  const pathEnd = workflow.indexOf("          if-no-files-found:", pathStart);
  assert.ok(pathStart >= 0 && pathEnd > pathStart);
  const artifactPaths = workflow.slice(pathStart, pathEnd);
  assert.ok(artifactPaths.includes("prochelia-preview.sql.gpg"));
  assert.ok(artifactPaths.includes("README.txt"));
  assert.ok(!artifactPaths.includes("prochelia-preview.sql\n"));
});

test("V7 regression workflow lints and executes the scheduled backup contract test on relevant changes", () => {
  const lintStart = v7Workflow.indexOf("Lint guarded Preview deployment workflows");
  const testStart = v7Workflow.indexOf("Run V7 authorization regression tests");
  assert.ok(lintStart >= 0 && testStart > lintStart);
  const lintStep = v7Workflow.slice(lintStart, testStart);
  const testStep = v7Workflow.slice(testStart);
  assert.ok(lintStep.includes(".github/workflows/backup-preview-d1.yml"));
  assert.ok(testStep.includes("tests/backup-preview-d1-workflow.test.mjs"));
  assert.ok(v7Workflow.split(".github/workflows/backup-preview-d1.yml").length - 1 >= 2);
});
