import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("strategic schema helper is read-only and verifies migration-owned objects", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function ensureStrategicSchema(env) {");
  const end = source.indexOf("\nfunction promotionCandidate(", start);
  assert.ok(start >= 0 && end > start, "strategic schema helper must exist");
  const helper = source.slice(start, end);
  assert.match(helper, /SELECT name FROM sqlite_master/);
  assert.match(helper, /STRATEGIC_SCHEMA_NOT_READY/);
  const executable = helper.replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(executable, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(?:TABLE|INDEX|INTO|OR|SET)\b/i);
  for (const objectName of [
    "promotions", "idx_promotions_active", "promotion_recommendations",
    "idx_promotion_reco_status", "commercial_events", "idx_commercial_events",
    "market_signals", "idx_market_signals", "client_value_scores", "strategic_alerts"
  ]) assert.ok(helper.includes(objectName), `missing strategic schema contract: ${objectName}`);
});
