import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function intervenantWorkspaceReadModel(request, env)");
const end = source.indexOf("\nasync function intervenantApplicationWithdrawRoute", start);
assert.ok(start >= 0 && end > start, "intervenant workspace read model must exist");
const handler = source.slice(start, end);

test("intervenant workspace never exposes internal wallet figures as payable before PSP configuration", () => {
  assert.match(handler, /payments_configured:\s*paymentsConfigured\(env\)/);
  assert.match(handler, /wallet:\s*paymentsConfigured\(env\)\s*\?\s*wallet\s*:\s*null/);
  assert.match(handler, /payout_account:\s*null/);
});
