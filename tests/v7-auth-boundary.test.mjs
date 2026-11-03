import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const origin = "https://prochelia.pages.dev";
const noSessionDb = {
  prepare(sql) {
    return {
      bind() { return this; },
      async first() {
        return String(sql).includes('security_rate_limits') ? { request_count: 1 } : null;
      },
      async run() { return { success: true }; }
    };
  }
};

test("private V7 audit endpoint rejects unauthenticated callers before route logic", async () => {
  const response = await worker.fetch(new Request("https://api.example/api/v7/security/audit", {
    method: "POST",
    headers: { origin, "cf-connecting-ip": "203.0.113.10", "content-type": "application/json" },
    body: JSON.stringify({ action: "ATTEMPT" })
  }), { DB: noSessionDb });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("public V7 status endpoint remains available without a session", async () => {
  const response = await worker.fetch(new Request("https://api.example/api/v7/status"), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});
