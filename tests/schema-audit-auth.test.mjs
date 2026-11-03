import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const base = "https://prochelia-api-preview.rzem92.workers.dev";

for (const path of ["/api/core/schema", "/api/missions/schema"]) {
  test(`protects sensitive schema audit endpoint ${path} from unauthenticated access`, async () => {
    const response = await worker.fetch(new Request(base + path, { method: "GET" }), {});
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "UNAUTHENTICATED");
  });
}
