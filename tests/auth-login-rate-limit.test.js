import test from "node:test";
import assert from "node:assert/strict";
import { enforceLoginRateLimit } from "../src/index.js";

function mockEnv(countForBucket = () => 1) {
  const calls = [];
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /INSERT INTO auth_login_rate_limits/);
        assert.match(sql, /ON CONFLICT\(bucket,subject_hash,window_start\)/);
        return {
          bind(...args) {
            calls.push({ sql, args });
            return {
              async first() {
                return { attempts: countForBucket(args[1]) };
              }
            };
          }
        };
      }
    }
  };
  return { env, calls };
}

test("login limiter allows attempts below both thresholds", async () => {
  const { env } = mockEnv(() => 1);
  const request = new Request("https://prochelia.example/api/auth/login", {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.10" }
  });
  const result = await enforceLoginRateLimit(request, env, "User@Example.com");
  assert.deepEqual(result, { allowed: true, retryAfter: 0 });
});

test("login limiter blocks a repeated account/IP pair and returns retry time", async () => {
  const { env } = mockEnv(bucket => bucket === "login_pair_15m" ? 7 : 1);
  const request = new Request("https://prochelia.example/api/auth/login", {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.10" }
  });
  const result = await enforceLoginRateLimit(request, env, "User@Example.com");
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfter > 0 && result.retryAfter <= 900);
});

test("client-controlled X-Forwarded-For does not alter the trusted edge-IP bucket", async () => {
  const { env, calls } = mockEnv(() => 1);
  const first = new Request("https://prochelia.example/api/auth/login", {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.10", "X-Forwarded-For": "198.51.100.1" }
  });
  const second = new Request("https://prochelia.example/api/auth/login", {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.10", "X-Forwarded-For": "198.51.100.99" }
  });
  await enforceLoginRateLimit(first, env, "User@Example.com");
  await enforceLoginRateLimit(second, env, "User@Example.com");
  assert.equal(calls[0].args[2], calls[2].args[2]);
  assert.equal(calls[1].args[2], calls[3].args[2]);
});

test("raw email and IP are not persisted in rate-limit keys", async () => {
  const { env, calls } = mockEnv(() => 1);
  const request = new Request("https://prochelia.example/api/auth/login", {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.10" }
  });
  await enforceLoginRateLimit(request, env, "private@example.com");
  const serialized = JSON.stringify(calls.map(x => x.args));
  assert.equal(serialized.includes("private@example.com"), false);
  assert.equal(serialized.includes("203.0.113.10"), false);
});
