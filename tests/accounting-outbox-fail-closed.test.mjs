import test from "node:test";
import assert from "node:assert/strict";
import { executeQueuedAction } from "../src/index.js";

test("legacy accounting outbox cannot post a single unbalanced accounting row", async () => {
  let calls = 0;
  const env = { DB: { prepare() { calls += 1; throw new Error("D1 must not be touched"); } } };
  const result = await executeQueuedAction(env, {
    id: "accounting-action-1",
    action_type: "ACCOUNTING_ENTRY",
    entity_type: "INVOICE",
    entity_id: "synthetic-invoice-1",
    payload_json: JSON.stringify({ amount_cents: 1000, direction: "CREDIT" })
  });
  assert.deepEqual(result, { ok: false, error: "TENANT_SCOPED_EXECUTION_NOT_IMPLEMENTED" });
  assert.equal(calls, 0);
});
