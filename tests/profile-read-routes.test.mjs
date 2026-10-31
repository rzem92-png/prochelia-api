import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const env = { DB: {} };
const base = "https://prochelia-api.rzem92.workers.dev";

test("client profile list requires an authenticated session", async () => {
  const response = await worker.fetch(new Request(base + "/api/clients"), env);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error, "UNAUTHENTICATED");
});

test("provider profile list requires an authenticated session", async () => {
  const response = await worker.fetch(new Request(base + "/api/intervenants"), env);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error, "UNAUTHENTICATED");
});

test("profile read routes reject non-GET methods", async () => {
  for (const route of ["/api/clients", "/api/intervenants"]) {
    const response = await worker.fetch(new Request(base + route, { method: "POST" }), env);
    assert.equal(response.status, 405);
  }
});

test("public API contract advertises both profile routes", async () => {
  const response = await worker.fetch(new Request(base + "/api/info"), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(body.routes.includes("/api/clients"));
  assert.ok(body.routes.includes("/api/intervenants"));
});
