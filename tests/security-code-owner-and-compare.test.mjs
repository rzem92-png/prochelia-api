import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("client security resend checks profile ownership through clients.user_id", () => {
  const start = source.indexOf("async function securityResendCodes");
  const end = source.indexOf("async function securityClientCode", start);
  const handler = source.slice(start, end);
  assert.match(handler, /LEFT JOIN clients c ON c\.id=ms\.client_id/i);
  assert.match(handler, /c\.user_id AS client_user_id/);
  assert.match(handler, /sec\.client_user_id!==auth\.user\.id/);
  assert.doesNotMatch(handler, /sec\.client_id!==auth\.user\.id/);
});

test("mission security code comparison uses constant-time comparison", () => {
  const start = source.indexOf("async function securityVerifyCode");
  const end = source.indexOf("async function securityResendCodes", start);
  const handler = source.slice(start, end);
  assert.match(handler, /constantTimeStringEqual\(expected,stored\|\|''\)/);
  assert.doesNotMatch(handler, /expected===stored/);
});
