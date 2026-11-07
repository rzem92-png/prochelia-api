import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../src/index.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const endpoint = "https://prochelia-api.test/api/auth/bootstrap";
const token = "synthetic-bootstrap-token-for-tests-only";

function envForBootstrap(insertChanges = 0) {
  const statements = [];
  return {
    statements,
    BOOTSTRAP_TOKEN: token,
    DB: {
      prepare(sql) {
        statements.push(sql);
        return {
          bind(...args) {
            this.args = args;
            return this;
          },
          async first() {
            if (sql.includes("SELECT COUNT(*) AS total FROM users")) return { total: 0 };
            return null;
          },
          async run() {
            return { meta: { changes: insertChanges } };
          }
        };
      }
    }
  };
}

function request(auth = `Bearer ${token}`) {
  return new Request(endpoint, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@example.test",
      first_name: "Test",
      last_name: "Manager",
      password: "SyntheticStrongPassword123!"
    })
  });
}

test("bootstrap requires configured secret and valid bearer", async () => {
  const missingSecret = envForBootstrap(1);
  delete missingSecret.BOOTSTRAP_TOKEN;
  const missing = await worker.fetch(request(), missingSecret);
  assert.equal(missing.status, 503);

  const invalid = await worker.fetch(request("Bearer wrong-token"), envForBootstrap(1));
  assert.equal(invalid.status, 401);
});

test("bootstrap conditional insert returning zero changes refuses duplicate creation", async () => {
  const env = envForBootstrap(0);
  const response = await worker.fetch(request(), env);
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "BOOTSTRAP_ALREADY_USED");
  const insert = env.statements.find(sql => sql.includes("INSERT INTO users"));
  assert.ok(insert);
  assert.match(insert, /SELECT .*WHERE NOT EXISTS \(SELECT 1 FROM users\)/s);
});

test("bootstrap returns created only when atomic insert changes one row", async () => {
  const response = await worker.fetch(request(), envForBootstrap(1));
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.created, true);
  assert.equal(body.user.role, "gerante");
  assert.equal(body.user.email, "admin@example.test");
});
