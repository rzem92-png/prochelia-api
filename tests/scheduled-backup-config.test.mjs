import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const worker = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("the API Worker declares its daily UTC backup cron", () => {
  assert.deepEqual(config.triggers?.crons, ["*/1 * * * *", "0 3 * * *"]);
  assert.match(worker, /async scheduled\(event,env,ctx\)/);
  assert.match(worker, /runNationalBackup\(env,'AUTOMATIC'\)/);
});

test("automatic backup validates D1, R2 and encryption key before any schema writes", () => {
  const start = worker.indexOf("async function runNationalBackup");
  const end = worker.indexOf("async function nationalScaleStatus", start);
  assert.ok(start >= 0 && end > start, "runNationalBackup must be present");
  const backup = worker.slice(start, end);
  const databaseGuard = backup.indexOf("if(!env?.DB?.prepare)");
  const bucketGuard = backup.indexOf("if(!env?.BACKUP_BUCKET || typeof env.BACKUP_BUCKET.put !== 'function')");
  const keyGuard = backup.indexOf("if(typeof secret !== 'string' || secret.length === 0)");
  const schemaWrite = backup.indexOf("await ensureNationalContinuitySchema(env)");
  assert.ok(databaseGuard >= 0 && bucketGuard > databaseGuard && keyGuard > bucketGuard,
    "all required bindings and secrets must be validated in order");
  assert.ok(schemaWrite > keyGuard,
    "D1 schema initialization must not run before backup dependencies are verified");
});
