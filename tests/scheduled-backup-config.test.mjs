import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const worker = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("the Worker keeps only the operational queue cron; unsigned backup cron is disabled", () => {
  assert.deepEqual(config.triggers?.crons, ["*/1 * * * *"]);
  assert.match(worker, /async scheduled\(event,env,ctx\)/);
  assert.match(worker, /processBackgroundJobs\(internalRequest,env,\{scheduler:true\}\)/);
  assert.doesNotMatch(worker, /runNationalBackup\(env,'AUTOMATIC'\)/);
  assert.doesNotMatch(worker, /async function runNationalBackup/);
});

test("direct Worker backup endpoint fails closed and requires the signed EU workflow", () => {
  const start = worker.indexOf("if(request.method==='POST'&&url.pathname==='/api/system/backup/run')");
  const end = worker.indexOf("return __procheliaNationalHandle(request,env);", start);
  assert.ok(start >= 0 && end > start, "direct backup route must remain explicit");
  const route = worker.slice(start, end);
  assert.match(route, /SIGNED_BACKUP_WORKFLOW_REQUIRED/);
  assert.match(route, /\},503\)/);
  assert.doesNotMatch(route, /runNationalBackup/);
});

test("backup and scale status endpoints remain read-only and fail honestly", () => {
  const scaleStart = worker.indexOf("async function nationalScaleStatus");
  const backupStart = worker.indexOf("async function backupStatus", scaleStart);
  const routeStart = worker.indexOf("const __procheliaNationalHandle", backupStart);
  assert.ok(scaleStart >= 0 && backupStart > scaleStart && routeStart > backupStart);
  const scaleStatus = worker.slice(scaleStart, backupStart);
  const backupStatus = worker.slice(backupStart, routeStart);
  assert.doesNotMatch(scaleStatus, /ensureNationalContinuitySchema|\.run\(/);
  assert.doesNotMatch(backupStatus, /ensureNationalContinuitySchema|\.run\(/);
  assert.match(scaleStatus, /automatic:false/);
  assert.match(scaleStatus, /scheduleStatus:'NOT_ATTESTED'/);
  assert.match(scaleStatus, /encrypted:false/);
  assert.match(scaleStatus, /retentionStatus:'UNVERIFIED'/);
  assert.match(scaleStatus, /bindingPresent:bucketBindingPresent/);
  assert.match(scaleStatus, /configured:false/);
  assert.match(scaleStatus, /verificationStatus:'UNVERIFIED'/);
  assert.match(backupStatus, /automatic:false/);
  assert.match(backupStatus, /frequency:null/);
  assert.match(backupStatus, /retentionDays:null/);
  assert.match(backupStatus, /bindingPresent/);
  assert.match(backupStatus, /configured:false/);
  assert.match(backupStatus, /verificationStatus:'UNVERIFIED'/);
  assert.match(backupStatus, /schemaReady/);
});
