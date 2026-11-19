import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/backup-preview-d1.yml", import.meta.url), "utf8");
const configText = readFileSync(new URL("../wrangler.preview-migrations.jsonc", import.meta.url), "utf8");
const config = JSON.parse(configText
  .split("\n")
  .filter(line => !line.trimStart().startsWith("//"))
  .join("\n"));

test("scheduled Preview backup is main-only and checks out its exact workflow commit", () => {
  assert.match(workflow, /if:\s*github\.ref\s*==\s*'refs\/heads\/main'/);
  assert.match(workflow, /uses:\s*actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /ref:\s*\$\{\{\s*github\.sha\s*\}\}/);
  assert.match(workflow, /persist-credentials:\s*false/);
});

test("scheduled backup pins both workflow and Wrangler to the exact non-Production Preview D1", () => {
  assert.match(workflow, /DB_NAME:\s*prochelia-preview-eu-2026-11-17/);
  assert.match(workflow, /DB_ID:\s*e3cf167c-37e1-4d72-9ac6-b3e27c14b97f/);
  assert.match(workflow, /FORBIDDEN_PRODUCTION_DB_ID:\s*04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.match(workflow, /\$DB_ID\s*==\s*\$FORBIDDEN_PRODUCTION_DB_ID/);
  assert.deepEqual(config.d1_databases, [{
    binding: "PREVIEW_DB",
    database_name: "prochelia-preview-eu-2026-11-17",
    database_id: "e3cf167c-37e1-4d72-9ac6-b3e27c14b97f",
    migrations_dir: "migrations-preview-canonical"
  }]);
});

test("scheduled artifact contains encrypted export only and has bounded retention", () => {
  assert.match(workflow, /--cipher-algo AES256/);
  assert.match(workflow, /retention-days:\s*7/);
  const artifactPaths = workflow.match(/path:\s*\|\n([\s\S]*?)\n\s+if-no-files-found:/)?.[1] || "";
  assert.match(artifactPaths, /prochelia-preview\.sql\.gpg/);
  assert.match(artifactPaths, /README\.txt/);
  assert.doesNotMatch(artifactPaths, /prochelia-preview\.sql(?!\.gpg)/);
});
