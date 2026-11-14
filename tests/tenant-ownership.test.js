import test from "node:test";
import assert from "node:assert/strict";
import { resolveTenantReferences } from "../src/index.js";

function mockDb({ clientId="client-A", intervenantId="provider-A", missionClient="client-A", missionIntervenant="provider-A", extraClients=[], extraIntervenants=[] }={}) {
  const calls=[];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              calls.push({sql,values});
              if (sql.includes("FROM clients WHERE user_id")) return clientId ? {id:clientId} : null;
              if (sql.includes("FROM intervenants WHERE user_id")) return intervenantId ? {id:intervenantId} : null;
              if (sql.includes("FROM clients WHERE id=")) return [clientId,...extraClients].includes(values[0]) ? {id:values[0]} : null;
              if (sql.includes("FROM intervenants WHERE id=")) return [intervenantId,...extraIntervenants].includes(values[0]) ? {id:values[0]} : null;
              if (sql.includes("FROM missions WHERE id=? AND client_id=?")) return values[1]===missionClient ? {id:values[0]} : null;
              if (sql.includes("FROM missions WHERE id=? AND intervenant_id=?")) return values[1]===missionIntervenant ? {id:values[0]} : null;
              if (sql.includes("FROM missions WHERE id=?")) {
                if (values[0]==="mission-A") return {id:"mission-A",client_id:missionClient,intervenant_id:missionIntervenant};
                return null;
              }
              return null;
            }
          };
        }
      };
    }
  };
}

test("client tenant is derived from the authenticated user and not the request body", async () => {
  const DB=mockDb();
  const result=await resolveTenantReferences({DB},{user:{id:"user-A",role:"client"}},{});
  assert.deepEqual(result.references.client_id,"client-A");
  assert.equal(result.references.company_id,null);
  assert.equal(result.references.intervenant_id,null);
});

test("client cannot forge another client, company, or intervenant reference", async () => {
  for (const body of [
    {client_id:"client-B"},
    {company_id:"company-B"},
    {intervenant_id:"provider-B"}
  ]) {
    const result=await resolveTenantReferences({DB:mockDb()},{user:{id:"user-A",role:"client"}},body);
    assert.equal(result.error,"TENANT_REFERENCE_FORBIDDEN");
  }
});

test("client can reference only a mission belonging to its own profile", async () => {
  const own=await resolveTenantReferences({DB:mockDb()},{user:{id:"user-A",role:"client"}},{mission_id:"mission-A"});
  assert.equal(own.references.client_id,"client-A");
  const foreign=await resolveTenantReferences({DB:mockDb({missionClient:"client-B"})},{user:{id:"user-A",role:"client"}},{mission_id:"mission-A"});
  assert.equal(foreign.error,"MISSION_NOT_OWNED");
});

test("intervenant tenant is derived from the authenticated user and mission assignment is enforced", async () => {
  const DB=mockDb();
  const own=await resolveTenantReferences({DB},{user:{id:"provider-user-A",role:"intervenant"}},{mission_id:"mission-A"});
  assert.equal(own.references.intervenant_id,"provider-A");
  const foreign=await resolveTenantReferences({DB:mockDb({missionIntervenant:"provider-B"})},{user:{id:"provider-user-A",role:"intervenant"}},{mission_id:"mission-A"});
  assert.equal(foreign.error,"MISSION_NOT_ASSIGNED");
});

test("manager cannot pair a mission with a different client or intervenant", async () => {
  const DB=mockDb();
  const badClient=await resolveTenantReferences({DB:mockDb({extraClients:["client-B"]})},{user:{id:"manager",role:"gerante"}},{mission_id:"mission-A",client_id:"client-B"});
  assert.equal(badClient.error,"MISSION_CLIENT_MISMATCH");
  const badProvider=await resolveTenantReferences({DB:mockDb({extraIntervenants:["provider-B"]})},{user:{id:"manager",role:"gerante"}},{mission_id:"mission-A",intervenant_id:"provider-B"});
  assert.equal(badProvider.error,"MISSION_INTERVENANT_MISMATCH");
  const valid=await resolveTenantReferences({DB},{user:{id:"manager",role:"gerante"}},{mission_id:"mission-A",client_id:"client-A",intervenant_id:"provider-A"});
  assert.deepEqual(valid.references,{client_id:"client-A",company_id:null,intervenant_id:"provider-A",mission_id:"mission-A"});
});

test("enterprise role fails closed until a verified company-user mapping exists", async () => {
  const DB=mockDb();
  const result=await resolveTenantReferences({DB},{user:{id:"company-user",role:"entreprise"}},{company_id:"company-A"});
  assert.equal(result.error,"COMPANY_OWNERSHIP_NOT_CONFIGURED");
  assert.equal(DB.calls.length,0);
});

test("unknown roles fail closed", async () => {
  const result=await resolveTenantReferences({DB:mockDb()},{user:{id:"x",role:"unknown"}},{});
  assert.equal(result.error,"FORBIDDEN");
});

test("Copilot mission changes are queued for review, never written directly from case context", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function executeCaseBusinessAction");
  const end = source.indexOf("async function processActionOutbox", start);
  const body = source.slice(start, end);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(body, /MANAGER_AND_ELIGIBILITY_REVIEW_REQUIRED/);
  assert.match(body, /MANAGER_AND_CONFLICT_REVIEW_REQUIRED/);
  assert.doesNotMatch(body, /UPDATE\\s+missions\\s+SET/i);
});

test("complaint creation compensates if its operational case cannot be created", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function complaintCreate");
  const end = source.indexOf("async function setPhase", start);
  const body = source.slice(start, end);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(body, /COMPLAINT_CASE_CREATION_FAILED/);
  assert.ok(body.includes("DELETE FROM complaints WHERE id=?"));
  assert.ok(body.includes("!caseResponse.ok || !caseJson?.case_id"));
});
