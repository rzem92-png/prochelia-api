import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("function getCookie(request, name) {");
const end = source.indexOf("\n\nfunction sessionCookie", start);
assert.notEqual(start, -1, "getCookie helper must exist");
assert.notEqual(end, -1, "getCookie helper boundary must exist");
const helper = source.slice(start, end);
const getCookie = new Function("request", "name", helper + "\nreturn getCookie(request, name);");

function requestWithCookie(cookie) {
  return { headers: { get: (header) => header.toLowerCase() === "cookie" ? cookie : null } };
}

test("session cookie parser decodes a valid cookie value", () => {
  assert.equal(getCookie(requestWithCookie("other=x; prochelia_session=abc%2Fdef"), "prochelia_session"), "abc/def");
});

test("malformed session cookie fails closed without throwing", () => {
  assert.doesNotThrow(() => getCookie(requestWithCookie("prochelia_session=%E0%A4%A"), "prochelia_session"));
  assert.equal(getCookie(requestWithCookie("prochelia_session=%E0%A4%A"), "prochelia_session"), null);
});

test("missing session cookie remains absent", () => {
  assert.equal(getCookie(requestWithCookie("other=value"), "prochelia_session"), null);
});
