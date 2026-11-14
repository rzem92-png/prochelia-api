import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function financeRowsForUser");
const end = source.indexOf("\nfunction financeSummaryFromRows", start);
const body = source.slice(start, end);

test("finance transaction scope resolves the authenticated client profile ID", () => {
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(body, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(body, /where = 'client_id=\?'/);
  assert.match(body, /role === 'CLIENT' \|\| role === 'CLIENT_SOCIAL'/);
});

test("finance transaction scope resolves the authenticated intervenant profile ID", () => {
  assert.match(body, /SELECT id FROM intervenants WHERE user_id=\?/);
  assert.match(body, /where = 'intervenant_id=\?'/);
});

test("finance transaction scope fails closed without a verified profile mapping", () => {
  assert.match(body, /let where = '1=0'/);
  assert.match(body, /Company\/support roles stay fail-closed/);
});

test("finance database read failures are not converted into empty financial statements", () => {
  assert.doesNotMatch(body, /catch\s*\(\s*_\s*\)/);
  assert.match(body, /payment_transactions WHERE/);
  assert.match(body, /finance_workspace_entries/);
  assert.match(body, /payout_requests/);
});
