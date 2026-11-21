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

test("SUPRA GitHub file reader rejects secret-like paths before credentials", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/file?repository=rzem92-png/prochelia-api&path=.env"),
    {}, "/api/supra/github/file", auth
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "REPOSITORY_PATH_NOT_ALLOWED");
});

test("SUPRA GitHub file reader rejects path traversal before credentials", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/file?repository=rzem92-png/prochelia-api&path=src%2F..%2F.env"),
    {}, "/api/supra/github/file", auth
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "REPOSITORY_PATH_NOT_ALLOWED");
});


test("SUPRA GitHub file reader allows an approved workflow path before credentials", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/file?repository=rzem92-png/prochelia-api&path=.github%2Fworkflows%2Fv7-security-tests.yml"),
    {}, "/api/supra/github/file", auth
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "NOT_CONNECTED");
});

test("SUPRA GitHub commits route rejects unapproved repositories before credentials", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/commits?repository=attacker/repo"), {},
    "/api/supra/github/commits", auth
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "REPOSITORY_NOT_ALLOWED");
});

test("SUPRA GitHub check-runs route validates the commit SHA before credentials", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/check-runs?repository=rzem92-png/prochelia-api&sha=not-a-sha"), {},
    "/api/supra/github/check-runs", auth
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "COMMIT_SHA_INVALID");
});

test("SUPRA GitHub commits and check-runs routes remain read-only", async () => {
  for (const path of ["/api/supra/github/commits", "/api/supra/github/check-runs"]) {
    const response = await handleSupraGithubRoute(request(path, "POST"), {}, path, auth);
    assert.equal(response.status, 405);
  }
});

test("SUPRA GitHub inspection remains restricted to the owner role", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/commits?repository=rzem92-png/prochelia-api"), {},
    "/api/supra/github/commits", { user: { role: "intervenant" } }
  );
  assert.equal(response.status, 403);
});


test("SUPRA GitHub pull request diff rejects invalid PR numbers before credentials", async () => {
  for (const value of ["0", "-1", "1.5", "NaN", "999999999999999999999"]) {
    const response = await handleSupraGithubRoute(
      request("/api/supra/github/pull-request-diff?repository=rzem92-png/prochelia-api&pull_number=" + encodeURIComponent(value)),
      {}, "/api/supra/github/pull-request-diff", auth
    );
    assert.equal(response.status, 400, value);
    assert.equal((await response.json()).error, "PULL_REQUEST_NUMBER_INVALID");
  }
});

test("SUPRA GitHub pull request diff rejects unapproved repositories before credentials", async () => {
  const response = await handleSupraGithubRoute(
    request("/api/supra/github/pull-request-diff?repository=attacker/repo&pull_number=42"),
    {}, "/api/supra/github/pull-request-diff", auth
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "REPOSITORY_NOT_ALLOWED");
});

test("SUPRA GitHub pull request diff remains read-only and owner-only", async () => {
  const path = "/api/supra/github/pull-request-diff";
  const write = await handleSupraGithubRoute(
    request(path + "?repository=rzem92-png/prochelia-api&pull_number=42", "POST"), {}, path, auth
  );
  assert.equal(write.status, 405);
  const forbidden = await handleSupraGithubRoute(
    request(path + "?repository=rzem92-png/prochelia-api&pull_number=42"), {}, path,
    { user: { role: "intervenant" } }
  );
  assert.equal(forbidden.status, 403);
});


test("SUPRA bounded diff reader accepts content within byte limit", async () => {
  const { readBoundedText } = await import("../src/supra-github.js");
  const response = new Response(new TextEncoder().encode("diff --git a/a b/a\\n+safe"));
  assert.equal(await readBoundedText(response, 100), "diff --git a/a b/a\\n+safe");
});

test("SUPRA bounded diff reader cancels oversized streams before buffering them", async () => {
  const { readBoundedText } = await import("../src/supra-github.js");
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(40));
      controller.enqueue(new Uint8Array(40));
    },
    cancel() { cancelled = true; }
  });
  await assert.rejects(
    () => readBoundedText(new Response(stream), 64),
    /GITHUB_PULL_REQUEST_DIFF_TOO_LARGE/
  );
  assert.equal(cancelled, true);
});
