import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveOperationalCaseScope, financeRowsForUser } from "../src/index.js";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("non-manager operational cases derive client/intervenant ownership from session user", () => {
  const start = source.indexOf("async function resolveOperationalCaseScope");
  const end = source.indexOf("\nasync function createOperationalCase", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /SELECT id FROM clients WHERE user_id=\?/);
  assert.match(body, /SELECT id FROM intervenants WHERE user_id=\?/);
  assert.match(body, /missions WHERE id=\? AND client_id=\?/);
  assert.match(body, /missions WHERE id=\? AND intervenant_id=\?/);
  assert.match(body, /COMPANY_OWNERSHIP_NOT_VERIFIED/);
});

test("non-manager Copilot submissions are proposals and cannot execute automatically", () => {
  const start = source.indexOf("async function createOperationalCase");
  const end = source.indexOf("\n\nasync function getTableColumns", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /if\(!manager\) rec=\{\.\.\.rec,action:'PROPOSE',mode:'MANAGER_APPROVAL'\}/);
  assert.match(body, /const safeContext=manager/);
  assert.doesNotMatch(body, /executeOperationalCase\(env,id,null,true\)/);
});

test("complaint creation verifies ownership before inserting complaint records", () => {
  const start = source.indexOf("async function complaintCreate");
  const end = source.indexOf("\n\nasync function setPhase", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.ok(body.indexOf("resolveOperationalCaseScope") < body.indexOf("INSERT INTO complaints"));
});

test("persisted pricing quotes are manager-only until server-owned policy is authoritative", () => {
  const start = source.indexOf("async function pricingQuote");
  const end = source.indexOf("\nasync function financeSummary", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.ok(body.includes("requireAuthRole(request,env,['gerante'])"));
});


function ownershipDb(profile, mission) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              calls.push({sql, values});
              if (sql.includes("FROM clients WHERE user_id")) return profile;
              if (sql.includes("FROM intervenants WHERE user_id")) return profile;
              if (sql.includes("FROM missions WHERE id=? AND client_id=?")) return mission;
              if (sql.includes("FROM missions WHERE id=? AND intervenant_id=?")) return mission;
              return null;
            }
          };
        }
      };
    }
  };
}

test("client scope ignores forged IDs and resolves its own profile and mission", async () => {
  const DB = ownershipDb({id:"client-A"}, {id:"mission-A"});
  const scope = await resolveOperationalCaseScope({DB}, {user:{id:"user-A",role:"client"}}, {
    client_id:"client-B", company_id:"company-B", intervenant_id:"intervenant-B", mission_id:"mission-A"
  });
  assert.deepEqual(scope, {client_id:"client-A",company_id:null,intervenant_id:null,mission_id:"mission-A"});
  assert.deepEqual(DB.calls.map(x=>x.values), [["user-A"],["mission-A","client-A"]]);
});

test("client cannot attach a mission owned by another client", async () => {
  const DB = ownershipDb({id:"client-A"}, null);
  const scope = await resolveOperationalCaseScope({DB}, {user:{id:"user-A",role:"client"}}, {mission_id:"mission-B"});
  assert.deepEqual(scope, {error:"MISSION_FORBIDDEN"});
});

test("intervenant scope is derived from the authenticated user and rejects another mission", async () => {
  const DB = ownershipDb({id:"intervenant-A"}, null);
  const scope = await resolveOperationalCaseScope({DB}, {user:{id:"user-A",role:"intervenant"}}, {
    intervenant_id:"intervenant-B", mission_id:"mission-B"
  });
  assert.deepEqual(scope, {error:"MISSION_FORBIDDEN"});
  assert.deepEqual(DB.calls.map(x=>x.values), [["user-A"],["mission-B","intervenant-A"]]);
});

test("company scope fails closed until ownership mapping is verified", async () => {
  const DB = ownershipDb(null, null);
  const scope = await resolveOperationalCaseScope({DB}, {user:{id:"company-user",role:"entreprise"}}, {company_id:"company-A"});
  assert.deepEqual(scope, {error:"COMPANY_OWNERSHIP_NOT_VERIFIED"});
  assert.equal(DB.calls.length, 0);
});

test("manager scope remains explicitly manager supplied", async () => {
  const scope = await resolveOperationalCaseScope({DB:{}}, {user:{id:"manager",role:"gerante"}}, {
    client_id:"client-A", company_id:"company-A", intervenant_id:"intervenant-A", mission_id:"mission-A"
  });
  assert.deepEqual(scope, {client_id:"client-A",company_id:"company-A",intervenant_id:"intervenant-A",mission_id:"mission-A"});
});

test("consolidated routes authorize before schema helpers can issue DDL", () => {
  const start = source.indexOf("async function handleConsolidated");
  const end = source.indexOf("\n}", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.ok(body.indexOf("requireAuthRole(request,env,requiredRoles)") < body.indexOf("ensureConsolidatedSchema(env)"));
  assert.doesNotMatch(body, /const consolidatedPath = .*ensureConsolidatedSchema/);
});

function financeDb(profileRows = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              calls.push({method:"first",sql,values});
              if (sql.includes("FROM clients WHERE user_id")) return profileRows.client || null;
              if (sql.includes("FROM intervenants WHERE user_id")) return profileRows.intervenant || null;
              return null;
            },
            async all() {
              calls.push({method:"all",sql,values});
              if (sql.includes("FROM payment_transactions")) return {results:[{id:"payment-fixture"}]};
              return {results:[]};
            }
          };
        },
        async all() {
          calls.push({method:"all",sql,values:[]});
          if (sql.includes("FROM payment_transactions")) return {results:[{id:"payment-fixture"}]};
          return {results:[]};
        }
      };
    }
  };
}

test("finance client rows use the verified client profile ID, not the session user ID", async () => {
  const DB = financeDb({client:{id:"client-profile-A"}});
  await financeRowsForUser({DB},{id:"user-A",role:"client"});
  const paymentQuery = DB.calls.find(x=>x.sql.includes("FROM payment_transactions"));
  assert.deepEqual(paymentQuery.values,["client-profile-A"]);
});

test("finance intervenant rows use the verified intervenant profile ID", async () => {
  const DB = financeDb({intervenant:{id:"intervenant-profile-A"}});
  await financeRowsForUser({DB},{id:"user-A",role:"intervenant"});
  const paymentQuery = DB.calls.find(x=>x.sql.includes("FROM payment_transactions"));
  assert.deepEqual(paymentQuery.values,["intervenant-profile-A"]);
});

test("finance roles without a verified payment tenant never fall back to the user ID", async () => {
  const DB = financeDb();
  await financeRowsForUser({DB},{id:"company-user-A",role:"company"});
  const paymentQuery = DB.calls.find(x=>x.sql.includes("FROM payment_transactions"));
  assert.match(paymentQuery.sql,/WHERE 1=0/);
  assert.deepEqual(paymentQuery.values,[]);
});

test("finance client without a verified profile receives no payment rows", async () => {
  const DB = financeDb();
  await financeRowsForUser({DB},{id:"user-without-client-profile",role:"client"});
  const paymentQuery = DB.calls.find(x=>x.sql.includes("FROM payment_transactions"));
  assert.match(paymentQuery.sql,/WHERE 1=0/);
  assert.deepEqual(paymentQuery.values,[]);
});
