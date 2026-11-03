import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const base = "https://prochelia-api-preview.rzem92.workers.dev";

test("malformed session cookie fails closed without crashing auth", async () => {
  const response = await worker.fetch(
    new Request(base + "/api/auth/me", {
      method: "GET",
      headers: { cookie: "prochelia_session=%E0%A4%A" }
    }),
    {}
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

for (const path of ["/api/core/schema", "/api/missions/schema"]) {
  test(`protects sensitive schema audit endpoint ${path} from unauthenticated access`, async () => {
    const response = await worker.fetch(new Request(base + path, { method: "GET" }), {});
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "UNAUTHENTICATED");
  });
}
