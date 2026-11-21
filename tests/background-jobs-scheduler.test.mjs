import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const worker = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("Worker declares a minute-level scheduler and preserves the daily backup cron", () => {
  assert.deepEqual(config.triggers?.crons, ["*/1 * * * *", "0 3 * * *"]);
});

test("only the scheduled handler supplies the internal scheduler capability", () => {
  assert.match(worker, /async function processBackgroundJobs\(request,env,\{scheduler=false\}=\{\}\)/);
  assert.match(worker, /scheduler\s*\?\s*\{auth:\{user:\{id:'cloudflare-cron',role:'GERANTE'\}\}\}/);
  assert.match(worker, /event\\?\\.cron === '\\*\\/1 \\* \\* \\* \\*'/);
});

test("minute tick runs bounded processing; daily cron still starts automatic backup", () => {
  assert.match(worker, /event\?\.cron === '\*\/1 \* \* \* \*'[\s\S]*?processBackgroundJobs\(internalRequest,env,\{scheduler:true\}\)/);
  assert.match(worker, /event\?\.cron === '0 3 \* \* \*'[\s\S]*?runNationalBackup\(env,'AUTOMATIC'\)/);
  assert.match(worker, /ORDER BY created_at LIMIT 25/);
});
