import test from "node:test";
import assert from "node:assert/strict";
import { directoryList } from "../src/index.js";

test("directory list fails closed with 503 when the authenticated session schema is unavailable", async () => {
  const request = new Request("https://api.preview.example/api/clients", {
    headers: { cookie: "prochelia_session=synthetic-token" }
  });
  const response = await directoryList(
    request,
    { DB: { prepare() { throw new Error("no such column: active_tenant_id"); } } },
    "clients",
    async () => { throw new Error("no such column: active_tenant_id"); }
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error, "AUTHENTICATION_SCHEMA_UNAVAILABLE");
  assert.equal(body.write_enabled, false);
});

test("directory list still returns 401 when no session is present", async () => {
  const request = new Request("https://api.preview.example/api/clients");
  const response = await directoryList(
    request,
    { DB: { prepare() { throw new Error("database must not be queried"); } } },
    "clients",
    async () => null
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});
