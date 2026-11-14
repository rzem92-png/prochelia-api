import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function openPaymentDispute");
const end = source.indexOf("\nasync function paymentAdminResolve", start);
const body = source.slice(start, end);

test("client dispute ownership resolves the authenticated user to the client profile ID", () => {
  assert.match(body, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(body, /tx\.client_id !== clientProfile\.id/);
  assert.doesNotMatch(body, /tx\.client_id !== auth\.user\.id/);
});
