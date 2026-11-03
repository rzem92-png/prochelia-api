import test from "node:test";
import assert from "node:assert/strict";
import { claimActionExecution } from "../src/index.js";

function fakeDB(initialStatus = "PENDING") {
  const state = { status: initialStatus };
  return {
    state,
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async run() {
          if (sql.includes("UPDATE action_outbox") && sql.includes("status='RUNNING'")) {
            if (state.status === "PENDING" && params[0] === "action-1") {
              state.status = "RUNNING";
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          throw new Error("Unexpected SQL in test: " + sql);
        },
        async first() {
          if (sql.includes("SELECT status FROM action_outbox")) return { status: state.status };
          throw new Error("Unexpected SQL in test: " + sql);
        }
      };
    }
  };
}

test("only one concurrent caller can claim a pending outbox action", async () => {
  const DB = fakeDB();
  const env = { DB };
  const results = await Promise.all([
    claimActionExecution(env, "action-1"),
    claimActionExecution(env, "action-1")
  ]);
  assert.equal(results.filter(x => x.claimed).length, 1);
  assert.equal(results.filter(x => !x.claimed && x.status === "RUNNING").length, 1);
  assert.equal(DB.state.status, "RUNNING");
});

test("completed outbox action cannot be claimed again", async () => {
  const DB = fakeDB("DONE");
  const result = await claimActionExecution({ DB }, "action-1");
  assert.deepEqual(result, { claimed: false, status: "DONE" });
  assert.equal(DB.state.status, "DONE");
});

test("unknown outbox action fails closed", async () => {
  const DB = fakeDB("NOT_FOUND");
  const result = await claimActionExecution({ DB }, "missing");
  assert.deepEqual(result, { claimed: false, status: "NOT_FOUND" });
});
