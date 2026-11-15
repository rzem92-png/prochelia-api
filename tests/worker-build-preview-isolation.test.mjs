import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/worker-build-validation.yml", import.meta.url), "utf8");

test("Worker build validation generates an isolated Preview config", () => {
  assert.match(workflow, /Generate isolated Preview config for bundle validation/);
  assert.match(workflow, /prochelia-api-preview/);
  assert.match(workflow, /prochelia-preview-db/);
  assert.match(workflow, /6adb95e5-e542-4bec-9008-fbea01042305/);
  assert.match(workflow, /wrangler\.preview\.generated\.json/);
  assert.match(workflow, /deploy --dry-run/);
});

test("Worker build validation cannot dry-run against Production D1", () => {
  assert.match(workflow, /04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.match(workflow, /Preview bundle validation must never bind Production D1/);
  assert.doesNotMatch(workflow, /deploy --dry-run --config wrangler\.jsonc/);
});
