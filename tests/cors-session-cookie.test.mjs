import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../src/index.js";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("session cookie is HttpOnly, Secure and usable for the configured cross-site frontend", () => {
  assert.match(source, /HttpOnly; Secure; SameSite=None/);
});

test("Worker CORS wrapper validates the allowlist before preflight or dispatch", () => {
  const wrapper = source.indexOf("async function handleWithCors(request, env)");
  const originGuard = source.indexOf("if (origin && !securityOriginAllowed(request, env))", wrapper);
  const preflight = source.indexOf("if (request.method === 'OPTIONS')", wrapper);
  assert.ok(wrapper >= 0 && originGuard > wrapper && preflight > originGuard);
  assert.match(source.slice(wrapper, source.indexOf("export default", wrapper)), /CORS_HEADER_NOT_ALLOWED/);
  assert.match(source.slice(wrapper, source.indexOf("export default", wrapper)), /CORS_METHOD_NOT_ALLOWED/);
});

test("CORS reflects only the configured origin and permits credentialed HttpOnly cookie requests", () => {
  const wrapper = source.slice(source.indexOf("async function handleWithCors(request, env)"), source.indexOf("export default"));
  assert.match(wrapper, /access-control-allow-origin', origin/);
  assert.match(wrapper, /access-control-allow-credentials', 'true'/);
  assert.match(wrapper, /access-control-allow-methods/);
  assert.match(wrapper, /access-control-allow-headers/);
  assert.doesNotMatch(wrapper, /access-control-allow-origin['"]\s*,\s*['"]\*['"]/i);
});

test("Worker fetch dispatch uses the CORS wrapper", () => {
  assert.match(source, /fetch\(request,env\)\s*\{\s*return handleWithCors\(request,env\);\s*\}/);
});


test("runtime preflight accepts the exact Pages origin and credentialed JSON/idempotency headers", async () => {
  const response = await worker.fetch(new Request("https://prochelia-api.rzem92.workers.dev/api/auth/login", {
    method: "OPTIONS",
    headers: {
      Origin: "https://prochelia.pages.dev",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-idempotency-key"
    }
  }), {});
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://prochelia.pages.dev");
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
});

test("runtime preflight rejects an unapproved origin and an unapproved request header", async () => {
  const originResponse = await worker.fetch(new Request("https://prochelia-api.rzem92.workers.dev/api/auth/login", {
    method: "OPTIONS",
    headers: {
      Origin: "https://attacker.example",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type"
    }
  }), {});
  assert.equal(originResponse.status, 403);
  assert.equal(originResponse.headers.get("access-control-allow-origin"), null);

  const headerResponse = await worker.fetch(new Request("https://prochelia-api.rzem92.workers.dev/api/auth/login", {
    method: "OPTIONS",
    headers: {
      Origin: "https://prochelia.pages.dev",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-unapproved"
    }
  }), {});
  assert.equal(headerResponse.status, 403);
});
