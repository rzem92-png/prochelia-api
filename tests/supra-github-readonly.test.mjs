import test from "node:test";
import assert from "node:assert/strict";
import { handleSupraGithubRoute } from "../src/supra-github.js";

function request(path = "/api/supra/github/status", method = "GET") {
  return new Request("https://api.example.test" + path, { method });
}

test("SUPRA GitHub status rejects anonymous callers", async () => {
  const response = await handleSupraGithubRoute(request(), {}, "/api/supra/github/status", null);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("SUPRA GitHub status rejects non-manager roles", async () => {
  const response = await handleSupraGithubRoute(
    request(), {}, "/api/supra/github/status", { user: { role: "intervenant" } }
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "FORBIDDEN");
});

test("SUPRA GitHub reports not connected without secrets and never enables writes", async () => {
  const response = await handleSupraGithubRoute(
    request(), {}, "/api/supra/github/status", { user: { role: "gerante" } }
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "NOT_CONNECTED");
  assert.equal(body.mode, "READ_ONLY");
  assert.equal(body.write_enabled, false);
  assert.deepEqual(body.repositories, []);
});

test("SUPRA GitHub connector does not accept write methods", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/status", "POST"), {}, "/api/supra/github/status",
    { user: { role: "gerante" } }
  );
  assert.equal(response.status, 405);
});
