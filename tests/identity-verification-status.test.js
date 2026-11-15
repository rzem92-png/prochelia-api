import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("identity status endpoint is GET-only and wired to the backend handler", () => {
  assert.match(source, /url\.pathname === '\/api\/security\/identity\/status'[\s\S]*?request\.method !== 'GET'[\s\S]*?securityIdentityStatus\(request, env\)/);
});

test("intervenants can only read their own server-side identity verification", () => {
  const start = source.indexOf("async function securityIdentityStatus");
  const end = source.indexOf("async function securityIdentityApprove", start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /auth\.user\.role === 'intervenant'/);
  assert.match(handler, /WHERE user_id=\?/);
  assert.match(handler, /\.bind\(auth\.user\.id\)/);
  assert.match(handler, /authority:'SERVER_D1'/);
  assert.doesNotMatch(handler, /localStorage/);
});

test("only the GERANTE role can read the verification review queue", () => {
  const start = source.indexOf("async function securityIdentityStatus");
  const end = source.indexOf("async function securityIdentityApprove", start);
  const handler = source.slice(start, end);
  assert.match(handler, /auth\.user\.role === 'gerante'/);
  assert.match(handler, /JOIN users u ON u\.id=iv\.user_id/);
  assert.match(handler, /LIMIT 100/);
  assert.match(handler, /FORBIDDEN/);
});
