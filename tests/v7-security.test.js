import test from "node:test";
import assert from "node:assert/strict";
import { handleV7Route } from "../src/v7-routes.js";

const post = (path, body) => new Request("https://example.test" + path, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body ?? {})
});

test("permission route rejects unauthenticated caller", async () => {
  const response = await handleV7Route(
    post("/api/v7/check/permissions", { role: "gerante", permissions: { anything: true } }),
    {},
    "/api/v7/check/permissions",
    null
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("permission route ignores caller-supplied role and permission map", async () => {
  const response = await handleV7Route(
    post("/api/v7/check/permissions", { role: "gerante", permissions: { delete_users: true } }),
    {},
    "/api/v7/check/permissions",
    { user: { id: "client-1", role: "client" } }
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "FORBIDDEN");
});

test("permission route uses manager role from authenticated session", async () => {
  const response = await handleV7Route(
    post("/api/v7/check/permissions", { role: "client", permissions: { delete_users: false }, permission: "delete_users" }),
    {},
    "/api/v7/check/permissions",
    { user: { id: "manager-1", role: "gerante" } }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.role, "gerante");
});

test("audit route rejects unauthenticated caller", async () => {
  const response = await handleV7Route(
    post("/api/v7/security/audit", { action: "TEST", actorId: "forged", actorRole: "gerante" }),
    {},
    "/api/v7/security/audit",
    null
  );
  assert.equal(response.status, 401);
});

test("audit route rejects non-manager session", async () => {
  const response = await handleV7Route(
    post("/api/v7/security/audit", { action: "TEST", actorId: "forged", actorRole: "gerante" }),
    {},
    "/api/v7/security/audit",
    { user: { id: "client-1", role: "client" } }
  );
  assert.equal(response.status, 403);
});

test("audit actor is taken from authenticated session, not request body", async () => {
  const response = await handleV7Route(
    post("/api/v7/security/audit", { action: "TEST_ACTION", actorId: "forged", actorRole: "admin" }),
    {},
    "/api/v7/security/audit",
    { user: { id: "manager-real", role: "gerante" } }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.audit.actorId, "manager-real");
  assert.equal(body.audit.actorRole, "gerante");
});
