import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function createMissionPayment(request, env) {");
const end = source.indexOf("\\nasync function finalizeMissionPayment", start);
const body = source.slice(start, end);

test("mission payment creation requires an authenticated manager", () => {
  assert.notEqual(start, -1);
  assert.match(body, /getSessionUser\\(request,env\\)/);
  assert.match(body, /requireRole\\(auth,\\['gerante'\\]\\)/);
});

test("mission payment creation fails closed before all D1 access when no PSP adapter exists", () => {
  assert.match(body, /PSP_ADAPTER_NOT_IMPLEMENTED/);
  assert.match(body, /return json\\(\\{ok:false,error:'PSP_ADAPTER_NOT_IMPLEMENTED',version:VERSION\\},503\\)/);
  assert.doesNotMatch(body, /env\\.DB|ensurePaymentSchema|INSERT INTO|UPDATE |DELETE FROM|\\.run\\(/);
});
