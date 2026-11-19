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
  assert.match(workflow, /if:\\s*github\\.ref\\s*==\\s*'refs\\/heads\\/main'/);
  assert.match(workflow, /actions\\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
  assert.match(workflow, /ref:\\s*\\$\\{\\{\\s*github\\.sha\\s*\\}\\}/);
  assert.match(workflow, /persist-credentials:\\s*false/);
});

test("scheduled backup rejects the Production D1 and pins the migration-only config to the exact EU Preview D1", () => {
  assert.match(workflow, /DB_NAME:\\s*prochelia-preview-eu-2026-11-17/);
  assert.match(workflow, /DB_ID:\\s*e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /FORBIDDEN_PRODUCTION_DB_ID:\\s*04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.match(workflow, /"\\$DB_ID"\\s*==\\s*"\\$FORBIDDEN_PRODUCTION_DB_ID"/);
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
  assert.doesNotMatch(workflow, /wrangler@4 deploy|d1 migrations apply/);
});

test("scheduled artifact contains only an AES-256 encrypted export with bounded seven-day retention", () => {
  assert.match(workflow, /--cipher-algo AES256/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --decrypt/);
  assert.match(workflow, /retention-days:\\s*7/);
  const artifactPaths = workflow.match(/path:\\s*\\|\\n([\\s\\S]*?)\\n\\s+if-no-files-found:/)?.[1] || "";
  assert.match(artifactPaths, /prochelia-preview\\.sql\\.gpg/);
  assert.match(artifactPaths, /README\\.txt/);
  assert.doesNotMatch(artifactPaths, /prochelia-preview\\.sql(?!\\.gpg)/);
});

test("V7 regression workflow lints and executes the scheduled backup contract test on relevant changes", () => {
  assert.match(v7Workflow, /actionlint[^\\n]*[\\s\\S]*backup-preview-d1\\.yml/);
  assert.match(v7Workflow, /tests\\/backup-preview-d1-workflow\\.test\\.mjs/);
  assert.equal((v7Workflow.match(/\\.github\\/workflows\\/backup-preview-d1\\.yml/g) || []).length >= 2, true);
});
