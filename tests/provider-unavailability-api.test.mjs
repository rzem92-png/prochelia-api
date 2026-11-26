import test from "node:test";
import assert from "node:assert/strict";
import { handleProviderUnavailabilityRoute } from "../src/provider-unavailability-api.js";

const BASE="/api/v7/provider-unavailability";
const auth=(id="user-1",role="client")=>({user:{id,role,email:id+"@example.test"}});
function mockDB({memberships=[],providers=[],blocks=[],failSchema=false,insertError=null}={}){
  const calls=[];
  const db={prepare(sql){if(failSchema&&sql.includes("tenant_memberships"))throw new Error("no such table: tenant_memberships");return {sql,bind(...params){calls.push({sql,params});return{
    all:async()=>{if(sql.includes("tenant_memberships"))return{results:memberships};if(sql.includes("provider_unavailability"))return{results:blocks.filter(x=>params[0]==="tenant-a"&&(!params.includes(x.intervenant_id)||params.includes(x.intervenant_id)))};return{results:[]};},
    first:async()=>{if(sql.includes("intervenants"))return providers.find(x=>sql.includes("user_id")?x.user_id===params[0]&&x.tenant_id===params[1]:x.id===params[0]&&x.tenant_id===params[1])||null;if(sql.includes("provider_unavailability")&&sql.includes("WHERE id = ?"))return blocks.find(x=>x.id===params[0]&&x.tenant_id===params[1])||null;return null;},
    run:async()=>{if(sql.includes("INSERT INTO provider_unavailability")){if(insertError)throw insertError;const [id,tenant_id,intervenant_id,start_at,end_at,timezone_name,reason,,created_by_user_id]=params;const row={id,tenant_id,intervenant_id,start_at,end_at,timezone_name,reason,status:"ACTIVE",created_by_user_id,created_at:"2026-11-26T00:00:00.000Z",updated_at:"2026-11-26T00:00:00.000Z"};blocks.push(row);return{meta:{changes:1}};}if(sql.includes("UPDATE provider_unavailability")){const [id,tenant_id,providerId]=params;const row=blocks.find(x=>x.id===id&&x.tenant_id===tenant_id&&(!sql.includes("intervenant_id = ?")||x.intervenant_id===providerId)&&x.status==="ACTIVE");if(row){row.status="CANCELLED";row.updated_at="2026-11-26T01:00:00.000Z";return{meta:{changes:1}};}return{meta:{changes:0}};}return{meta:{changes:0}};}
  }};}};
  return{db,calls};
}
const activeMembership=(role="PROVIDER",tenantId="tenant-a")=>({tenant_id:tenantId,role,status:"ACTIVE",tenant_status:"ACTIVE"});
const provider=(id="provider-1",userId="user-1",tenantId="tenant-a")=>({id,user_id:userId,tenant_id:tenantId});
const block=(id="block-1",providerId="provider-1",tenantId="tenant-a")=>({id,tenant_id:tenantId,intervenant_id:providerId,start_at:"2026-11-26T09:00:00.000Z",end_at:"2026-11-26T10:00:00.000Z",timezone_name:"Europe/Paris",reason:"",status:"ACTIVE",created_at:"2026-11-26T00:00:00.000Z",updated_at:"2026-11-26T00:00:00.000Z"});
const req=(method,path=BASE,body=null,headers={})=>new Request("https://api.preview"+path,{method,headers:{"content-type":"application/json",...headers},...(body!==null?{body:JSON.stringify(body)}:{})});

test("route is isolated, unauthenticated requests fail and missing tenant schema fails closed",async()=>{
  assert.equal(await handleProviderUnavailabilityRoute(req("GET","/api/v7/other"),{}, "/api/v7/other",auth()),null);
  const unauth=await handleProviderUnavailabilityRoute(req("GET"),{DB:mockDB().db},BASE,null);
  assert.equal(unauth.status,401);
  const missing=await handleProviderUnavailabilityRoute(req("GET"),{DB:mockDB({failSchema:true}).db},BASE,auth());
  assert.equal(missing.status,503);
  assert.equal((await missing.json()).error,"TENANT_SCHEMA_UNAVAILABLE");
});

test("tenant must be an active membership and ambiguous memberships require explicit selection",async()=>{
  const noMembership=await handleProviderUnavailabilityRoute(req("GET"),{DB:mockDB().db},BASE,auth());
  assert.equal(noMembership.status,403);
  const multi=mockDB({memberships:[activeMembership("ADMIN"),activeMembership("OPS","tenant-b")]});
  const ambiguous=await handleProviderUnavailabilityRoute(req("GET"),{DB:multi.db},BASE,auth("user-1","gerante"));
  assert.equal(ambiguous.status,409);
  assert.equal((await ambiguous.json()).error,"TENANT_SELECTION_REQUIRED");
});

test("provider GET is scoped to the provider's own records and tenant",async()=>{
  const db=mockDB({memberships:[activeMembership()],providers:[provider(),provider("provider-2","user-2")],blocks:[block(),block("block-2","provider-2")]});
  const response=await handleProviderUnavailabilityRoute(req("GET",BASE+"?providerId=provider-2"),{DB:db.db},BASE,auth());
  assert.equal(response.status,403);
  const own=await handleProviderUnavailabilityRoute(req("GET"),{DB:db.db},BASE,auth());
  assert.equal(own.status,200);
  const data=await own.json();
  assert.equal(data.unavailability.length,1);
  assert.equal(data.unavailability[0].providerId,"provider-1");
});

test("tenant admin can filter within tenant and cannot query cross-tenant provider",async()=>{
  const db=mockDB({memberships:[activeMembership("ADMIN")],providers:[provider(),provider("provider-2","user-2")],blocks:[block(),block("block-2","provider-2")]});
  const response=await handleProviderUnavailabilityRoute(req("GET",BASE+"?providerId=provider-2"),{DB:db.db},BASE,auth("user-1","gerante"));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.unavailability.length,1);
  const cross=await handleProviderUnavailabilityRoute(req("GET",BASE+"?providerId=provider-x"),{DB:db.db},BASE,auth("user-1","gerante"));
  assert.equal(cross.status,404);
});

test("provider creates a block only for own tenant-scoped profile; request tenant is ignored",async()=>{
  const db=mockDB({memberships:[activeMembership()],providers:[provider()]});
  const response=await handleProviderUnavailabilityRoute(req("POST",BASE,{tenantId:"tenant-b",providerId:"provider-1",startAt:"2026-11-26T09:00:00Z",endAt:"2026-11-26T10:00:00Z",timeZone:"Europe/Paris",reason:"Congé"}),{DB:db.db},BASE,auth());
  assert.equal(response.status,201);
  const data=await response.json();
  assert.equal(data.unavailability.providerId,"provider-1");
  const insert=db.calls.find(x=>x.sql.includes("INSERT INTO provider_unavailability"));
  assert.equal(insert.params[1],"tenant-a");
  assert.equal(insert.params.at(-1),"user-1");
  assert.equal(insert.params[6],"Congé");
  assert.equal(data.unavailability.status,"ACTIVE");
});

test("invalid UTC, reversed interval, invalid IANA timezone and overlong reason are rejected",async()=>{
  const db=mockDB({memberships:[activeMembership()],providers:[provider()]});
  const cases=[
    {startAt:"2026-11-26T09:00:00",endAt:"2026-11-26T10:00:00Z",timeZone:"Europe/Paris"},
    {startAt:"2026-11-26T10:00:00Z",endAt:"2026-11-26T09:00:00Z",timeZone:"Europe/Paris"},
    {startAt:"2026-11-26T09:00:00Z",endAt:"2026-11-26T10:00:00Z",timeZone:"Not/AZone"},
    {startAt:"2026-11-26T09:00:00Z",endAt:"2026-11-26T10:00:00Z",timeZone:"Europe/Paris",reason:"x".repeat(121)},
  ];
  for(const value of cases){const response=await handleProviderUnavailabilityRoute(req("POST",BASE,{providerId:"provider-1",...value}),{DB:db.db},BASE,auth());assert.equal(response.status,400);}
});

test("database overlap trigger is surfaced as a conflict",async()=>{
  const db=mockDB({memberships:[activeMembership()],providers:[provider()],insertError:new Error("PROVIDER_UNAVAILABILITY_OVERLAP")});
  const response=await handleProviderUnavailabilityRoute(req("POST",BASE,{providerId:"provider-1",startAt:"2026-11-26T09:00:00Z",endAt:"2026-11-26T10:00:00Z",timeZone:"Europe/Paris"}),{DB:db.db},BASE,auth());
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,"UNAVAILABILITY_CONFLICT");
});

test("cancel is a tenant-scoped soft status change; provider cannot cancel another profile's block",async()=>{
  const db=mockDB({memberships:[activeMembership()],providers:[provider()],blocks:[block()]});
  const response=await handleProviderUnavailabilityRoute(req("DELETE",BASE+"/block-1"),{DB:db.db},BASE+"/block-1",auth());
  assert.equal(response.status,200);
  assert.equal((await response.json()).unavailability.status,"CANCELLED");
  const update=db.calls.find(x=>x.sql.includes("UPDATE provider_unavailability"));
  assert.equal(update.params[1],"tenant-a");
  const cross=await handleProviderUnavailabilityRoute(req("DELETE",BASE+"/block-x"),{DB:db.db},BASE+"/block-x",auth());
  assert.equal(cross.status,404);
});

test("read-only tenant role cannot create or cancel",async()=>{
  const db=mockDB({memberships:[activeMembership("READ_ONLY")]});
  const create=await handleProviderUnavailabilityRoute(req("POST",BASE,{providerId:"provider-1"}),{DB:db.db},BASE,auth());
  assert.equal(create.status,403);
  const cancel=await handleProviderUnavailabilityRoute(req("DELETE",BASE+"/block-1"),{DB:db.db},BASE+"/block-1",auth());
  assert.equal(cancel.status,403);
});
