import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/worker-build-validation.yml", "utf8");

test("Worker build validation runs only the generated Preview config", () => {
  const commands = workflow.split("\n").filter(line => line.includes("wrangler@4 deploy --dry-run"));
  assert.equal(commands.length, 1);
  assert.match(commands[0], /--config wrangler\.preview\.generated\.json/);
  assert.doesNotMatch(commands[0], /wrangler\.jsonc|production/i);
  assert.match(workflow, /node scripts\/generate-preview-wrangler-config\.mjs/);
  assert.match(workflow, /--outdir "\$RUNNER_TEMP\/prochelia-preview-worker-dry-run"/);
});

test("build workflow has read-only GitHub permissions and never deploys", () => {
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.doesNotMatch(workflow, /wrangler deploy(?! --dry-run)/);
});
