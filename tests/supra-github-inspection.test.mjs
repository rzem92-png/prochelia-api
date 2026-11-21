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

test("SUPRA GitHub inspection rejects an unapproved repository before requiring credentials", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/pull-requests?repository=attacker/repo"),
    {}, "/api/supra/github/pull-requests", auth
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "REPOSITORY_NOT_ALLOWED");
});

test("SUPRA GitHub connector ignores unknown paths", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/dispatch"), {}, "/api/supra/github/dispatch", auth
  );
  assert.equal(response, null);
});

test("SUPRA GitHub file reader rejects paths outside approved source areas", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/file?repository=rzem92-png/prochelia-api&path=.env"),
    {}, "/api/supra/github/file", auth
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "REPOSITORY_NOT_ALLOWED");
});

test("SUPRA GitHub file reader rejects path traversal before credentials", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/file?repository=rzem92-png/prochelia-api&path=src%2F..%2F.env"),
    {}, "/api/supra/github/file", auth
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "REPOSITORY_PATH_NOT_ALLOWED");
});
