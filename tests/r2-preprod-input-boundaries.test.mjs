import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/r2-preprod-smoke.js";

const token = "t".repeat(40);
function makeEnv() {
  let writes = 0;
  return {
    env: {
      R2_TEST_TOKEN: token,
      R2_STAGING: {
        async put() { writes++; },
        async get() { return null; },
        async delete() {},
        async head() { return null; }
      }
    },
    writes: () => writes
  };
}

test("R2 smoke rejects invalid or oversized declared Content-Length before storage", async () => {
  for (const declared of ["-1", "1.5", "abc", "65"]) {
    const {env, writes} = makeEnv();
    const request = new Request("https://preprod.invalid/api/r2/smoke", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-length": declared
      },
      body: "PROCHELIA-R2-PREPROD-TEST"
    });
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 413, "declared length should be rejected: " + declared);
    assert.equal(writes(), 0, "storage must not be called for declared length: " + declared);
  }
});

test("R2 smoke rejects payload that differs by one byte from the approved synthetic payload", async () => {
  const {env, writes} = makeEnv();
  const response = await worker.fetch(new Request("https://preprod.invalid/api/r2/smoke", {
    method: "POST",
    headers: {authorization: "Bearer " + token},
    body: "PROCHELIA-R2-PREPROD-TEST "
  }), env);
  assert.equal(response.status, 400);
  assert.equal(writes(), 0);
});
