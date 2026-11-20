import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const worker = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("the API Worker declares its daily UTC backup cron", () => {
  assert.deepEqual(config.triggers?.crons, ["0 3 * * *"]);
  assert.match(worker, /async scheduled\(event,env,ctx\)/);
  assert.match(worker, /runNationalBackup\(env,'AUTOMATIC'\)/);
});
