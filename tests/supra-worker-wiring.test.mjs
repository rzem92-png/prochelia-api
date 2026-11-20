import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("Nexus routes are wired behind the production rate limiter and real D1 session", () => {
  assert.match(source, /import \{ handleSupraRoute \} from "\.\/supra-api\.js";/);
  assert.match(source, /path\.startsWith\('\/api\/supra\/'\)/);
  const dispatch = source.indexOf("if (u.pathname.startsWith('/api/supra/'))");
  const limiter = source.indexOf("const rate=await productionRateLimit(request,env);");
  assert.ok(dispatch > limiter, "Nexus dispatch must run after the production rate limiter");
  const route = source.slice(dispatch, dispatch + 500);
  assert.match(route, /getSessionUser\(request,env\)/);
  assert.match(route, /handleSupraRoute\(request,env,auth\)/);
});

test("Nexus CORS preflight only reflects explicitly allowed origins", () => {
  const preflight = source.indexOf("Explicit CORS preflight for the authenticated Nexus browser API");
  assert.notEqual(preflight, -1);
  const block = source.slice(preflight, preflight + 1200);
  assert.match(block, /securityOriginAllowed\(request,env\)/);
  assert.match(block, /access-control-allow-origin', origin/);
  assert.doesNotMatch(block, /access-control-allow-origin', '\*'/);
  assert.match(block, /'access-control-allow-methods': 'GET, POST, OPTIONS'/);
});
