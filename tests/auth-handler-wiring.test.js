import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("all support/system authorization helpers reference the real session resolver", () => {
  assert.equal(/\bgetAuth\s*\(/.test(source), false, "undefined getAuth() calls must not remain");
  assert.match(source, /async function supportAuth\(request,env\)[\s\S]*?getSessionUser\(request,env\)/);
});

test("system scale and backup routes require a manager session", () => {
  const routes = source.slice(source.indexOf("const __procheliaNationalHandle = handle"));
  assert.equal((routes.match(/getSessionUser\(request,env\)/g) || []).length >= 3, true);
  assert.match(routes, /auth\.user\|\|String\(auth\.user\.role\|\|''\)\.toUpperCase\(\)!=='GERANTE'/);
});


test("session cookie parsing never URI-decodes attacker-controlled cookie bytes", () => {
  const match = source.match(/function getCookie\(request, name\) \{[\s\S]*?\n\}/);
  assert.ok(match, "getCookie must exist");
  assert.doesNotMatch(match[0], /decodeURIComponent/);
  assert.match(match[0], /return part\.slice\(idx \+ 1\)\.trim\(\)/);
});
