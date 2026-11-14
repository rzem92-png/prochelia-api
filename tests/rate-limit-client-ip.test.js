import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("rate-limit identity trusts only the Cloudflare edge client IP header", () => {
  const start = source.indexOf("async function productionSubjectHash");
  const end = source.indexOf("\nasync function productionRateLimit", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /CF-Connecting-IP/);
  assert.doesNotMatch(body, /X-Forwarded-For/i);
});
