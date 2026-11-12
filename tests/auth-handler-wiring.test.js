import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("all support/system authorization helpers reference the real session resolver", () => {
  assert.equal(/\bgetAuth\s*\(/.test(source), false, "undefined getAuth() calls must not remain");
  assert.match(source, /async function supportAuth\(request,env\)[\s\S]*?getSessionUser\(request,env\)/);
});

test("system scale and backup routes require an authenticated GERANTE session", () => {
  const marker = "const __procheliaNationalHandle = handle";
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, "national system handler must exist");
  const end = source.indexOf("PROCHÉLIA — COMPLÉMENT MAÎTRE", start);
  assert.notEqual(end, -1, "national system handler boundary must exist");
  const routes = source.slice(start, end);

  const protectedRoutes = [
    ["GET", "/api/system/scale", "nationalScaleStatus"],
    ["GET", "/api/system/backups", "backupStatus"],
    ["POST", "/api/system/backup/run", "runNationalBackup"]
  ];

  for (const [method, path, action] of protectedRoutes) {
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const route = new RegExp(
      "request\\.method===['\"]" + method + "['\"]&&url\\.pathname===['\"]" +
      escapedPath + "['\"][\\s\\S]*?(?=\\n\\s*if\\(request\\.method|\\n\\s*return __procheliaNationalHandle|$)"
    );
    const match = routes.match(route);
    assert.ok(match, `expected protected route ${method} ${path}`);
    assert.match(match[0], /getSessionUser\(request,env\)/, `${path} must resolve the session`);
    assert.match(match[0], /!auth\?\.user\|\|String\(auth\.user\.role\|\|''\)\.toUpperCase\(\)!=='GERANTE'/, `${path} must deny missing or non-GERANTE sessions`);
    assert.match(match[0], new RegExp(action), `${path} must call its expected action only after authorization`);
  }
});
