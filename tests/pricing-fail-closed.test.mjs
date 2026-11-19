import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

test("disabled pricing quote route does not run consolidated schema DDL", async () => {
  const statements = [];
  const DB = {
    prepare(sql) {
      statements.push(sql);
      return {
        bind() { return this; },
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() { return { success: true, meta: { changes: 0 } }; }
      };
    }
  };
  const request = new Request("https://api.example.test/api/pricing/quote", {
    method: "POST",
    headers: {
      origin: "https://4c3cec36.prochelia.pages.dev",
      "content-type": "application/json"
    },
    body: JSON.stringify({ base_price_cents: 1, platform_fee_percent: 99 })
  });
  const response = await worker.fetch(request, {
    DB,
    CORS_ORIGIN: "https://4c3cec36.prochelia.pages.dev"
  });
  assert.equal(response.status, 401);
  assert.ok(statements.every(sql => !/^\s*(CREATE|INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(sql)),
    "the disabled quote route must not trigger schema creation or database writes");
});
