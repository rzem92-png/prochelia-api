import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/backup-preview-d1.yml", import.meta.url), "utf8");

test("legacy Preview D1 backup is disabled and cannot create an un-attested artifact or scheduled export", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /schedule:/);
  assert.match(workflow, /intentionally disabled/);
  assert.match(workflow, /backup-preview-d1-to-r2-eu\.yml/);
  assert.doesNotMatch(workflow, /wrangler@4 d1 export/);
  assert.doesNotMatch(workflow, /aws s3 cp/);
  assert.doesNotMatch(workflow, /upload-artifact/);
});
