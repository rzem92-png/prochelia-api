import test from "node:test";
import assert from "node:assert/strict";

test("payment dispute and manual settlement routes remain fail-closed pending PSP integration", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(source, /PSP_VERIFIED_SETTLEMENT_REQUIRED/);
  assert.match(source, /PSP_DISPUTE_SETTLEMENT_REQUIRED/);
  assert.match(source, /SELECT pt\.\*,c\.user_id AS client_user_id/);
  assert.match(source, /LEFT JOIN clients c ON c\.id=pt\.client_id/);
  assert.match(source, /auth\.user\.role === 'client' && tx\.client_user_id !== auth\.user\.id/);
  assert.match(source, /amount > Number\(tx\.gross_cents \|\| 0\)/);
  assert.match(source, /WHERE id=\? AND status='paid'/);
});
