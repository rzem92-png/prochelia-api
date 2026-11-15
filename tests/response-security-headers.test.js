import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("the exported Worker fetch applies security headers after every route handler", () => {
  const start = source.indexOf("function withSecurityHeaders");
  const end = source.indexOf("async scheduled(event,env,ctx)", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);
  for (const header of [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy",
    "cache-control"
  ]) assert.ok(block.includes(header), `missing ${header}`);
  assert.match(block, /const response=await handle\(request,env\)/);
  assert.match(block, /return withSecurityHeaders\(response,request\)/);
});
