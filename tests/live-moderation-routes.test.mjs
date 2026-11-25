import test from "node:test";
import assert from "node:assert/strict";
import { handleV7Route } from "../src/v7-routes.js";

const post = (path, body) => new Request("https://example.test" + path, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body ?? {})
});
const path = "/api/v7/live/moderation/evaluate";
const authenticated = { user: { id: "test-user", role: "client" } };

test("live moderation endpoint requires an authenticated session", async () => {
  const response = await handleV7Route(post(path, { text: "comment" }), {}, path, null);
  assert.equal(response.status, 401);
});

test("endpoint returns a policy plan for a targeted insult without echoing message text", async () => {
  const source = "Tu es un connard.";
  const response = await handleV7Route(post(path, { text: source }), {}, path, authenticated);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.evaluation.decision, "block");
  assert.equal(body.execution, "policy_plan_only");
  assert.ok(!JSON.stringify(body).includes(source));
});

test("endpoint allows factual crime debate", async () => {
  const response = await handleV7Route(post(path, { text: "Le débat doit se baser sur les faits du dossier." }), {}, path, authenticated);
  const body = await response.json();
  assert.equal(body.evaluation.decision, "allow");
});

test("endpoint rejects invalid profile and oversized body", async () => {
  const invalid = await handleV7Route(post(path, { text: "hello", profile: "unknown" }), {}, path, authenticated);
  assert.equal(invalid.status, 400);
  const large = await handleV7Route(post(path, { text: "x".repeat(9000) }), {}, path, authenticated);
  assert.equal(large.status, 413);
});

test("endpoint rejects non-POST methods", async () => {
  const response = await handleV7Route(new Request("https://example.test" + path), {}, path, authenticated);
  assert.equal(response.status, 405);
});
