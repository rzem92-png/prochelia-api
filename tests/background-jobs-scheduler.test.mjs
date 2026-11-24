import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const worker = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("Worker declares only the minute-level operational queue scheduler", () => {
  assert.deepEqual(config.triggers?.crons, ["*/1 * * * *"]);
});

test("only the scheduled handler supplies the internal scheduler capability", () => {
  assert.match(worker, /async function processBackgroundJobs\(request,env,\{scheduler=false\}=\{\}\)/);
  assert.match(worker, /scheduler\s*\?\s*\{auth:\{user:\{id:'cloudflare-cron',role:'GERANTE'\}\}\}/);
  assert.match(worker, /event\?\.cron === '\*\/1 \* \* \* \*'/);
});

test("minute tick runs bounded processing; unsigned backup cron is absent", () => {
  assert.match(worker, /event\?\.cron === '\*\/1 \* \* \* \*'[\s\S]*?processBackgroundJobs\(internalRequest,env,\{scheduler:true\}\)/);
  assert.doesNotMatch(worker, /event\?\.cron === '0 3 \* \* \*'/);
  assert.doesNotMatch(worker, /runNationalBackup/);
  assert.match(worker, /ORDER BY created_at LIMIT 25/);
});
