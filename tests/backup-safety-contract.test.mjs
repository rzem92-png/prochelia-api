import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("legacy Worker backup is never scheduled as a completed backup", () => {
  assert.doesNotMatch(source, /ctx\.waitUntil\(runNationalBackup\(/);
  assert.match(source, /PROCHELIA_BACKUP_DISABLED/);
  assert.match(source, /BACKUP_PIPELINE_NOT_RESTORE_CAPABLE/);
});

test("backup status cannot advertise encryption, automation, or restoration as ready", () => {
  assert.match(source, /configured:false,enabled:false,automatic:false,encrypted:false,restorable:false/);
  assert.match(source, /backupFrequency:'DISABLED_UNTIL_RESTORE_VALIDATED'/);
  assert.match(source, /automatic:false,encrypted:false,restorable:false,status:'DISABLED_UNTIL_RESTORE_VALIDATED'/);
});

test("manual Worker backup fails closed with HTTP 503", () => {
  assert.match(source, /BACKUP_PIPELINE_NOT_RESTORE_CAPABLE',backup_enabled:false\},503/);
});
