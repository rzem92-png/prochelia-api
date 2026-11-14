import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function paymentOnboard");
const end = source.indexOf("\nasync function paymentStatus", start);
const body = source.slice(start, end);

test("PSP account identifiers are server-owned, not caller-controlled", () => {
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.doesNotMatch(body, /readJson\(request\)/);
  assert.doesNotMatch(body, /body\?\.provider_account_id/);
  assert.match(body, /const accountId = null/);
});
