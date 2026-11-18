import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const managerRow = {
  id: "manager-1",
  role: "gerante",
  email: "manager@example.test",
  first_name: "Synthetic",
  last_name: "Manager",
  phone: null,
  status: "active",
  created_at: "2026-11-18 00:00:00",
  updated_at: "2026-11-18 00:00:00",
  session_id: "synthetic-session-1"
};

function managerEnv() {
  const statements = [];
  const writes = [];
  const bucketWrites = [];
  const env = {
    BACKUP_BUCKET: {
      async put(...args) { bucketWrites.push(args); }
    },
    BACKUP_ENCRYPTION_KEY: "synthetic-only-key",
    DB: {
      prepare(sql) {
        statements.push(sql);
        return {
          bind() {
            return {
              async first() {
                if (/FROM sessions s/.test(sql)) return managerRow;
                if (/sqlite_master/.test(sql)) return { name: "backup_runs" };
                throw new Error("Unexpected D1 first(): " + sql);
              },
              async all() {
                if (/sqlite_master/.test(sql)) {
                  return { results: [
                    { name: "platform_scale_config" },
                    { name: "backup_runs" },
                    { name: "backup_objects" }
                  ] };
                }
                if (/FROM platform_scale_config/.test(sql)) return { results: [] };
                if (/FROM backup_runs/.test(sql)) return { results: [] };
                throw new Error("Unexpected D1 all(): " + sql);
              },
              async run() {
                writes.push(sql);
                throw new Error("Unexpected D1 write: " + sql);
              }
            };
          },
          async first() {
            if (/sqlite_master/.test(sql)) return { name: "backup_runs" };
            throw new Error("Unexpected D1 first(): " + sql);
          },
          async all() {
            if (/sqlite_master/.test(sql)) {
              return { results: [
                { name: "platform_scale_config" },
                { name: "backup_runs" },
                { name: "backup_objects" }
              ] };
            }
            if (/FROM platform_scale_config/.test(sql)) return { results: [] };
            if (/FROM backup_runs/.test(sql)) return { results: [] };
            throw new Error("Unexpected D1 all(): " + sql);
          },
          async run() {
            writes.push(sql);
            throw new Error("Unexpected D1 write: " + sql);
          }
        };
      }
    }
  };
  return { env, statements, writes, bucketWrites };
}

function managerRequest(path, method = "GET") {
  return new Request("https://api.example.test" + path, {
    method,
    headers: { cookie: "prochelia_session=synthetic-session-token" }
  });
}

test("GET /api/system/scale is read-only and never creates or seeds schema", async () => {
  const { env, statements, writes } = managerEnv();
  const response = await worker.fetch(managerRequest("/api/system/scale"), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schemaReady, true);
  assert.equal(body.backups.automatic, false);
  assert.equal(body.backups.attestationRequired, true);
  assert.equal(body.backups.encrypted, false);
  assert.equal(body.backups.encryptionStatus, "UNVERIFIED");
  assert.ok(statements.every(sql => !/\b(CREATE|INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(sql)));
  assert.equal(writes.length, 0);
});

test("GET /api/system/backups reads evidence without DDL or D1 writes", async () => {
  const { env, statements, writes } = managerEnv();
  const response = await worker.fetch(managerRequest("/api/system/backups"), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schemaReady, true);
  assert.equal(body.automatic, false);
  assert.equal(body.retentionStatus, "UNVERIFIED");
  assert.equal(body.attestationRequired, true);
  assert.equal(body.attestationStatus, "UNVERIFIED");
  assert.equal(body.configured, false);
  assert.equal(body.storageBindingPresent, true);
  assert.equal(body.encryptionKeyPresent, true);
  assert.equal(body.manualExecutionEnabled, false);
  assert.ok(statements.every(sql => !/\b(CREATE|INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(sql)));
  assert.equal(writes.length, 0);
});

test("manual backup remains fail-closed until HMAC, Object Lock and isolated restore are validated", async () => {
  const { env, writes, bucketWrites } = managerEnv();
  const response = await worker.fetch(managerRequest("/api/system/backup/run", "POST"), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "BACKUP_ATTESTATION_PIPELINE_REQUIRED");
  assert.equal(writes.length, 0);
  assert.equal(bucketWrites.length, 0);
});

test("scheduled handler is a no-op even for the former daily backup cron", async () => {
  const { env, statements, writes, bucketWrites } = managerEnv();
  let waits = 0;
  await worker.scheduled({ cron: "0 3 * * *" }, env, { waitUntil() { waits += 1; } });
  assert.equal(statements.length, 0);
  assert.equal(writes.length, 0);
  assert.equal(bucketWrites.length, 0);
  assert.equal(waits, 0);
});
