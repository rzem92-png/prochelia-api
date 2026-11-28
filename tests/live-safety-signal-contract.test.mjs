import test from "node:test";
import assert from "node:assert/strict";
import {validateLiveSafetySignalEnvelope} from "../src/live-safety-signal-contract.js";
const NOW=Date.parse("2026-11-28T10:00:00Z");
const valid={
 signal_id:"sig-001",stream_id:"room-001",room_version:"4",actor_id:"host-001",
 actor_type:"host",category:"drug_use_or_display",severity:"critical",modality:"video",
 confidence:0.96,observed_at:"2026-11-28T09:59:59Z",territory:"FR",
 provider_id:"detector-x",model_version:"vision-3",policy_version:"2026-11-28.1",
 evidence_ref:"case-evidence:opaque-123",context_flags:["live"],expires_at:"2026-11-28T10:01:00Z"
};
test("valid signal envelope accepted",()=>assert.equal(validateLiveSafetySignalEnvelope(valid,{nowMs:NOW}).valid,true));
test("missing identifiers rejected",()=>{const r=validateLiveSafetySignalEnvelope({...valid,signal_id:"",stream_id:""},{nowMs:NOW});assert.equal(r.valid,false);assert.ok(r.errors.some(e=>e.field==="signal_id"));});
test("unknown actor/category/modality/severity rejected",()=>{const r=validateLiveSafetySignalEnvelope({...valid,actor_type:"admin",category:"not_a_policy",modality:"video-stream",severity:"extreme"},{nowMs:NOW});assert.equal(r.valid,false);for(const f of ["actor_type","category","modality","severity"])assert.ok(r.errors.some(e=>e.field===f));});
test("confidence NaN, out of range and string rejected",()=>{for(const confidence of [NaN,-0.01,1.01,"0.9"])assert.equal(validateLiveSafetySignalEnvelope({...valid,confidence},{nowMs:NOW}).valid,false);});
test("stale and future events rejected",()=>{assert.ok(validateLiveSafetySignalEnvelope({...valid,observed_at:"2026-11-28T09:40:00Z"},{nowMs:NOW}).errors.some(e=>e.code==="EVENT_TOO_OLD"));assert.ok(validateLiveSafetySignalEnvelope({...valid,observed_at:"2026-11-28T10:05:00Z"},{nowMs:NOW}).errors.some(e=>e.code==="EVENT_IN_FUTURE"));});
test("territory must be region-formatted",()=>assert.equal(validateLiveSafetySignalEnvelope({...valid,territory:"France"},{nowMs:NOW}).valid,false));
test("public evidence URLs forbidden",()=>assert.ok(validateLiveSafetySignalEnvelope({...valid,evidence_ref:"https://public.example/evidence"},{nowMs:NOW}).errors.some(e=>e.code==="OPAQUE_REFERENCE_ONLY")));
test("expiry must be after observation",()=>assert.ok(validateLiveSafetySignalEnvelope({...valid,expires_at:valid.observed_at},{nowMs:NOW}).errors.some(e=>e.code==="MUST_FOLLOW_OBSERVED_AT")));
test("malformed non-object rejected",()=>assert.equal(validateLiveSafetySignalEnvelope(null,{nowMs:NOW}).valid,false));
