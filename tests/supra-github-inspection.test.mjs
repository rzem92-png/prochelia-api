import test from "node:test";
import assert from "node:assert/strict";
import { handleSupraGithubRoute } from "../src/supra-github.js";

const auth = { user: { role: "gerante" } };
const request = (url, method = "GET") => new Request("https://api.example.test" + url, { method });

test("SUPRA GitHub inspection refuses write methods", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/pull-requests?repository=rzem92-png/prochelia-api", "POST"),
    {}, "/api/supra/github/pull-requests", auth
  );
  assert.equal(response.status, 405);
});

test("SUPRA GitHub inspection rejects an unapproved repository before calling GitHub", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/pull-requests?repository=attacker/repo"),
    {}, "/api/supra/github/pull-requests", auth
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "NOT_CONNECTED");
  assert.equal(body.write_enabled, false);
});

test("SUPRA GitHub connector ignores unknown paths", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/dispatch"), {}, "/api/supra/github/dispatch", auth
  );
  assert.equal(response, null);
});
