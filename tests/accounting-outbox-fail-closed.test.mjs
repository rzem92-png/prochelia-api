import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const match = source.match(/else if \(action\.action_type === 'ACCOUNTING_ENTRY'\) \{([\s\S]*?)\n    \} else result=/);

test("generic operational actions cannot post unbalanced or unscoped accounting entries", () => {
  assert.ok(match, "ACCOUNTING_ENTRY branch must remain explicit");
  assert.match(match[1], /requires_provider:true/);
  assert.match(match[1], /TENANT_SCOPED_DOUBLE_ENTRY_LEDGER_NOT_IMPLEMENTED/);
  assert.doesNotMatch(match[1], /INSERT INTO accounting_ledger/);
  assert.doesNotMatch(match[1], /payload\.amount_cents/);
});
