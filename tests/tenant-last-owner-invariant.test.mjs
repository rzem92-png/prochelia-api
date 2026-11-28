import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const migration = readFileSync(new URL("../migrations-preview-canonical/0023_tenant_workspace_foundation.sql", import.meta.url), "utf8");

function dbFixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY, role TEXT NOT NULL, email TEXT NOT NULL);
    CREATE TABLE sessions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id));
    INSERT INTO users(id,role,email) VALUES ('u1','client','owner@example.test'),('u2','client','owner2@example.test'),('u3','client','admin@example.test');
  `);
  db.exec(migration);
  db.exec(`
    INSERT INTO tenants(id,kind,display_name,created_by_user_id) VALUES ('t1','ORGANIZATION','Org','u1'), ('t2','ORGANIZATION','Other Org','u3');
    INSERT INTO tenant_memberships(id,tenant_id,user_id,role,status,accepted_at)
      VALUES ('m1','t1','u1','OWNER','ACTIVE','2026-01-01'),
             ('m2','t1','u2','OWNER','ACTIVE','2026-01-01'),
             ('m3','t1','u3','ADMIN','ACTIVE','2026-01-01');
  `);
  return db;
}

test("last active owner cannot be revoked, suspended, downgraded, moved or deleted", () => {
  const db = dbFixture();
  for (const sql of [
    "UPDATE tenant_memberships SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP WHERE id='m1'",
    "UPDATE tenant_memberships SET status='SUSPENDED' WHERE id='m1'",
    "UPDATE tenant_memberships SET role='ADMIN' WHERE id='m1'",
    
    "DELETE FROM tenant_memberships WHERE id='m1'"
  ]) db.exec(sql);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tenant_memberships WHERE tenant_id='t1' AND role='OWNER' AND status='ACTIVE'").get().n, 1);
  assert.throws(() => db.exec("UPDATE tenant_memberships SET tenant_id='t2' WHERE id='m2'"), /TENANT_MEMBERSHIP_IDENTITY_IMMUTABLE/);
  assert.throws(() => db.exec("UPDATE tenant_memberships SET user_id='u3' WHERE id='m2'"), /TENANT_MEMBERSHIP_IDENTITY_IMMUTABLE/);
  for (const sql of [
    "UPDATE tenant_memberships SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP WHERE id='m2'",
    "UPDATE tenant_memberships SET status='SUSPENDED' WHERE id='m2'",
    "UPDATE tenant_memberships SET role='ADMIN' WHERE id='m2'",
    "UPDATE tenant_memberships SET tenant_id='t2' WHERE id='m2'",
    "DELETE FROM tenant_memberships WHERE id='m2'"
  ]) assert.throws(() => db.exec(sql), /TENANT_LAST_ACTIVE_OWNER_REQUIRED/);
});

test("last-owner protection allows removal when another active owner remains", () => {
  const db = dbFixture();
  db.exec("UPDATE tenant_memberships SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP WHERE id='m1'");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tenant_memberships WHERE tenant_id='t1' AND role='OWNER' AND status='ACTIVE'").get().n, 1);
  db.exec("UPDATE tenant_memberships SET role='ADMIN' WHERE id='m1'");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tenant_memberships WHERE tenant_id='t1' AND role='OWNER' AND status='ACTIVE'").get().n, 1);
});

test("invitation acceptance is restricted to the matching normalized email identity", () => {
  const db = dbFixture();
  db.exec(`
    INSERT INTO tenant_invitations(
      id,tenant_id,invitee_email,token_hash,role,invited_by_user_id,expires_at
    ) VALUES ('i1','t1','admin@example.test','${"a".repeat(64)}','MEMBER','u1','2099-01-01T00:00:00Z');
  `);
  assert.throws(() => db.exec(`
    UPDATE tenant_invitations
       SET status='ACCEPTED', accepted_by_user_id='u2', accepted_at=CURRENT_TIMESTAMP
     WHERE id='i1'
  `), /TENANT_INVITATION_ACCEPTOR_EMAIL_MISMATCH/);
  db.exec(`
    UPDATE tenant_invitations
       SET status='ACCEPTED', accepted_by_user_id='u3', accepted_at=CURRENT_TIMESTAMP
     WHERE id='i1'
  `);
  assert.equal(db.prepare("SELECT status,accepted_by_user_id FROM tenant_invitations WHERE id='i1'").get().status, "ACCEPTED");
  assert.equal(db.prepare("SELECT accepted_by_user_id FROM tenant_invitations WHERE id='i1'").get().accepted_by_user_id, "u3");
});
