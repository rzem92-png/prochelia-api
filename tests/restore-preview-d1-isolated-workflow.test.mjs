import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/restore-preview-d1-from-r2-isolated.yml", import.meta.url), "utf8");

test("isolated R2 restore is manual, confirmation-gated, and restricted to main", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /RESTORE_R2_TO_ISOLATED_D1/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read\s*\n\s+actions: read/);
  assert.match(workflow, /actions\\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\\/setup-node@[0-9a-f]{40}/);
});

test("restore pins the exact isolated EU D1 and forbids Preview and Production targets", () => {
  assert.match(workflow, /EXPECTED_DB_NAME: prochelia-r2-restore-validation-2026-11/);
  assert.match(workflow, /EXPECTED_DB_ID: 3caebbc6-982a-4562-96a7-e509185e9e9a/);
  assert.match(workflow, /SOURCE_DB_ID: 6adb95e5-e542-4bec-9008-fbea01042305/);
  assert.match(workflow, /FORBIDDEN_PRODUCTION_DB_ID: 04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.match(workflow, /jurisdiction == "eu"/);
});

test("restore authenticates the pinned backup, checks the empty target before import, and verifies integrity after", () => {
  const backup = workflow.indexOf("Vérifier le run de sauvegarde et son identité");
  const empty = workflow.indexOf("Cible isolée vide confirmée.");
  const restore = workflow.indexOf("Restaurer exclusivement dans la D1 isolée");
  const checks = workflow.indexOf("Contrôles post-restauration");
  assert.ok(backup >= 0 && backup < empty && empty < restore && restore < checks);
  assert.match(workflow, /43509759419/);
  assert.match(workflow, /ca1def14725d6f02f90b3679506b6b93137b6c2d/);
  assert.match(workflow, /PRAGMA quick_check/);
  assert.match(workflow, /PRAGMA foreign_key_check/);
  assert.match(workflow, /== "31"/);
  assert.match(workflow, /== "7"/);
  const restoreStart = workflow.indexOf("Restaurer exclusivement dans la D1 isolée");
  const restoreEnd = workflow.indexOf("\n      - name:", restoreStart + 10);
  const restoreStep = workflow.slice(restoreStart, restoreEnd);
  assert.doesNotMatch(workflow, /wrangler deploy|d1 migrations apply/);
  assert.doesNotMatch(restoreStep, /04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.match(restoreStep, /EXPECTED_DB_NAME/);
  assert.match(restoreStep, /EXPECTED_DB_ID/);
});
