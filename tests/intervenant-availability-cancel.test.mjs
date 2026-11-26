import test from "node:test";
import assert from "node:assert/strict";
import { cancelIntervenantAvailabilitySlot } from "../src/index.js";

const ID = "availability-12345678";
const PROFILE = "provider-a";
const TENANT = "tenant-a";

function mock({ slot = {
  id: ID,
  start_at: new Date(Date.now() + 3600000).toISOString(),
  end_at: new Date(Date.now() + 7200000).toISOString(),
  status: "available"
}, changes = 1 } = {}) {
  const calls = [];
  const DB = {
    prepare(sql) {
      calls.push(sql);
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("SELECT id, start_at, end_at, status")) return slot;
              throw new Error("Unexpected SELECT: " + sql);
            },
            async run() { return { meta: { changes } }; }
          };
        }
      };
    }
  };
  return { DB, calls };
}
async function call(m, id = ID) {
  return cancelIntervenantAvailabilitySlot(m, PROFILE, TENANT, id);
}

test("future available slot is cancelled with tenant/profile-scoped conditional update", async () => {
  const m = mock();
  const res = await call(m);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, availability: { id: ID, status: "cancelled" } });
  assert.match(m.calls[0], /WHERE id = \? AND intervenant_id = \? AND tenant_id = \?/);
  assert.match(m.calls[1], /WHERE id = \? AND intervenant_id = \? AND tenant_id = \? AND status = 'available'/);
  assert.match(m.calls[1], /julianday\(start_at\) > julianday\(\?\)/);
});

test("invalid identifier is rejected before database access", async () => {
  const m = mock();
  const r = await call(m, "bad");
  assert.equal(r.status, 400);
  assert.equal(m.calls.length, 0);
});

test("unknown slot returns 404", async () => {
  const m = mock({ slot: null });
  const r = await call(m);
  assert.equal(r.status, 404);
});

test("already cancelled slot replays idempotently", async () => {
  const m = mock({ slot: { id: ID, start_at: new Date(Date.now() + 3600000).toISOString(), end_at: new Date(Date.now() + 7200000).toISOString(), status: "cancelled" } });
  const r = await call(m);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).idempotent_replay, true);
  assert.equal(m.calls.length, 1);
});

test("booked slot is not cancellable", async () => {
  const m = mock({ slot: { id: ID, start_at: new Date(Date.now() + 3600000).toISOString(), end_at: new Date(Date.now() + 7200000).toISOString(), status: "booked" } });
  const r = await call(m);
  assert.equal(r.status, 409);
});

test("past availability cannot be cancelled", async () => {
  const m = mock({ slot: { id: ID, start_at: new Date(Date.now() - 3600000).toISOString(), end_at: new Date(Date.now() - 1800000).toISOString(), status: "available" } });
  const r = await call(m);
  assert.equal(r.status, 409);
});

test("concurrent state change with zero affected rows fails closed", async () => {
  const m = mock({ changes: 0 });
  const r = await call(m);
  assert.equal(r.status, 409);
});

test("missing tenant-scoped schema fails closed without an UPDATE", async () => {
  const calls = [];
  const env = { DB: { prepare(sql) { calls.push(sql); return { bind() { return { async first() { throw new Error("no such column tenant_id"); }, async run() { throw new Error("unexpected mutation"); } }; } }; } } };
  const r = await cancelIntervenantAvailabilitySlot(env, PROFILE, TENANT, ID);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "AVAILABILITY_CANCEL_REJECTED");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /tenant_id/);
});
