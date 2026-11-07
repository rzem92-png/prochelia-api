import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const base = "https://prochelia-api.test";

test("mutating mission endpoint fails closed when D1 is unavailable", async () => {
  const response = await worker.fetch(new Request(base + "/api/missions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: "synthetic", prestation_id: "test" })
  }), {});
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, "DATABASE_UNAVAILABLE");
  assert.equal(body.write_enabled, undefined);
});

test("mission validation remains disabled and does not accept a mutation", async () => {
  const response = await worker.fetch(new Request(base + "/api/missions/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mission_id: "synthetic-test" })
  }), {});
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.write_enabled, false);
});
