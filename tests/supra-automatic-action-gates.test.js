import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function executeCaseBusinessAction");
const end = source.indexOf("\nasync function processActionOutbox", start);
const body = source.slice(start, end);
const outboxStart = end;
const outboxEnd = source.indexOf("\nasync function ", outboxStart + 10);
const outbox = source.slice(outboxStart, outboxEnd);

test("SUPRA automatic mode cannot directly assign or reschedule a mission", () => {
  assert.match(body, /replacementId && c\.mission_id && !automatic/);
  assert.match(body, /if \(automatic\) \{[\s\S]*?MANAGER_APPROVAL_REQUIRED/);
  assert.match(body, /if \(context\.reschedule_start_at && c\.mission_id\)/);
});

test("unimplemented mission verification action is not falsely marked completed", () => {
  assert.match(outbox, /'MISSION_VERIFY_AND_NOTIFY'/);
  assert.match(outbox, /WAITING_PROVIDER/);
  assert.match(outbox, /no business effect was executed/);
});
