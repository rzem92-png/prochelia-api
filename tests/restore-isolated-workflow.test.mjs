import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/restore-production-backup-isolated-test.yml", import.meta.url), "utf8");

test("restore workflow pins a dedicated D1 and excludes Production and Preview", () => {
  assert.match(workflow, /RESTORE_DB_ID: 71526879-34c7-4b47-8195-7b8f82669e31/);
  assert.match(workflow, /EXPECTED_PRODUCTION_D1_ID: 04f52830-ef5a-4f17-a640-42bbc2381bba/);
  assert.match(workflow, /RESTORE_DB_ID.*!=.*EXPECTED_PRODUCTION_D1_ID/);
  assert.match(workflow, /RESTORE_DB_ID.*!=.*6adb95e5-e542-4bec-9008-fbea01042305/);
  assert.match(workflow, /RESTORE_PRODUCTION_BACKUP_TO_ISOLATED_TEST_D1/);
});

test("production backup R2 bucket must be confirmed EU before backup download", () => {
  const eu = workflow.indexOf("Verify production backup R2 bucket EU jurisdiction before download");
  const download = workflow.indexOf("Download and authenticate encrypted production backup from R2");
  assert.ok(eu >= 0 && download > eu);
  assert.match(workflow, /cf-r2-jurisdiction: eu/);
  assert.match(workflow, /\.result\.jurisdiction == "eu"/);
});

test("only a recent successful production backup run is accepted", () => {
  assert.match(workflow, /\.conclusion == "success"/);
  assert.match(workflow, /\.path == "\.github\/workflows\/backup-production-d1-to-r2\.yml"/);
  assert.match(workflow, /now_epoch - backup_epoch <= 86400/);
  assert.match(workflow, /checksum-verified/);
});

test("every remote D1 operation is pinned to the isolated restore Wrangler config", () => {
  const commands = workflow.split("\n").filter(line => line.includes("wrangler@4 d1 execute"));
  assert.ok(commands.length >= 4);
  for (const command of commands) assert.ok(command.includes('--config "$RUNNER_TEMP/wrangler.restore.json"'), command);
});

test("restore refuses non-empty targets and verifies integrity after import", () => {
  assert.match(workflow, /Restore target is not empty; refusing to overwrite any data/);
  assert.match(workflow, /PRAGMA quick_check/);
  assert.match(workflow, /PRAGMA foreign_key_check/);
  assert.match(workflow, /Required tables present/);
});
