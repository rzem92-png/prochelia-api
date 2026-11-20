import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("Nexus Supra dispatch is behind the shared production middleware and uses authenticated tenant authority", () => {
  const dispatch = source.indexOf("if (url.pathname.startsWith('/api/supra/'))");
  const limiter = source.indexOf("const rate=await productionRateLimit(request,env);");
  assert.ok(dispatch > limiter, "SUPRA must run after the shared production rate limiter");
  const block = source.slice(dispatch, dispatch + 1400);
  assert.match(block, /getSessionUser\(request, env\)/);
  assert.match(block, /resolveTenantContext\(request, env, supraAuth\)/);
  assert.match(block, /user: \{ \.\.\.supraAuth\.user, tenant_id: tenantContext\.tenant\.id \}/);
  assert.match(block, /handleSupraRoute\(request, env, supraAuth\)/);
  assert.doesNotMatch(block, /request\.json\(\).*tenant_id/s);
});

test("Nexus Supra never trusts caller-selected tenant identity", () => {
  const sourceContext = source.slice(source.indexOf("if (url.pathname.startsWith('/api/supra/'))"), source.indexOf("if (url.pathname.startsWith('/api/v7/'))"));
  assert.match(sourceContext, /resolveTenantContext/);
  assert.match(sourceContext, /tenantContext\.tenant\.id/);
  assert.doesNotMatch(sourceContext, /searchParams\.get\(['"]tenant/);
});
