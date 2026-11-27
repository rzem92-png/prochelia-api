/* Nexus incident lifecycle policy: pure validation and transition decisions.
 * Caller persists events/state. Human approval required for resolution/closure.
 * Preview/dev/test only; no autonomous execution, payments, sanctions, or PII.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusIncidentLifecycle=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENVS=new Set(["preview","development","test"]), STATES=new Set(["OPEN","ACKNOWLEDGED","INVESTIGATING","WAITING_HUMAN","MITIGATED","RESOLVED","CLOSED"]), SEV=new Set(["info","warning","high","critical"]), ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SLA={critical:15,high:60,warning:240,info:1440};
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function time(v){if(typeof v!=="string"||!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(v))return false;const n=Date.parse(v);return Number.isFinite(n)&&new Date(n).toISOString()===v}
function fail(){return {ok:false,status:"UNKNOWN",executionAllowed:false,mode:"INCIDENT_POLICY_ONLY",decision:"DENY",reason:"INPUT_INVALID"}}
function safeEvent(e){return {type:e.type,at:e.at,actorType:e.actorType,reasonCode:e.reasonCode??null}}
function evaluateIncident(input={}){
 if(!plain(input)||!ENVS.has(input.environment)||!time(input.now)||!plain(input.incident)||!ID.test(input.incident.id)||!SEV.has(input.incident.severity)||!STATES.has(input.incident.state)||!time(input.incident.createdAt)||Date.parse(input.incident.createdAt)>Date.parse(input.now)||!(input.incident.ownerId===null||input.incident.ownerId===undefined||ID.test(input.incident.ownerId))||!Array.isArray(input.events)||input.events.length>100||input.events.some(e=>!plain(e)||!time(e.at)||!ID.test(e.type)||!["human","system"].includes(e.actorType)||(e.reasonCode!==undefined&&!ID.test(e.reasonCode))))return fail();
 const i=input.incident, elapsed=Math.max(0,Math.floor((Date.parse(input.now)-Date.parse(i.createdAt))/60000)), sla=SLA[i.severity], slaBreached=elapsed>=sla&& !["RESOLVED","CLOSED"].includes(i.state);
 const assigned=typeof i.ownerId==="string"&&ID.test(i.ownerId);
 const permitted={OPEN:["ACKNOWLEDGED","WAITING_HUMAN"],ACKNOWLEDGED:["INVESTIGATING","WAITING_HUMAN"],INVESTIGATING:["WAITING_HUMAN","MITIGATED"],WAITING_HUMAN:["ACKNOWLEDGED","INVESTIGATING","MITIGATED"],MITIGATED:["RESOLVED"],RESOLVED:["CLOSED","INVESTIGATING"],CLOSED:["INVESTIGATING"]};
 let decision="NO_CHANGE", reason="STATE_VALID", nextState=i.state;
 const req=input.request;
 if(req!==undefined){
  if(!plain(req)||!ID.test(req.action)||!["human","system"].includes(req.actorType)||(req.reasonCode!==undefined&&!ID.test(req.reasonCode)))return fail();
  const action=req.action;
  if(action==="ASSIGN_OWNER"){if(req.actorType!=="human"||!ID.test(req.ownerId)){decision="DENY";reason="HUMAN_OWNER_ASSIGNMENT_REQUIRED";}else{decision="ALLOW";reason="OWNER_ASSIGNMENT_ACCEPTED";}}
  else if(action==="TRANSITION"&&STATES.has(req.toState)&&permitted[i.state].includes(req.toState)){
    if(["RESOLVED","CLOSED"].includes(req.toState)&&req.actorType!=="human"){decision="DENY";reason="HUMAN_APPROVAL_REQUIRED";}
    else if(["ACKNOWLEDGED","INVESTIGATING","MITIGATED"].includes(req.toState)&&!assigned){decision="DENY";reason="OWNER_REQUIRED";}
    else{decision="ALLOW";reason="TRANSITION_ALLOWED";nextState=req.toState;}
  }else if(action==="REOPEN"&&["RESOLVED","CLOSED"].includes(i.state)&&req.actorType==="human"&&req.toState==="INVESTIGATING"&&assigned){decision="ALLOW";reason="HUMAN_REOPEN_ALLOWED";nextState="INVESTIGATING";}
  else{decision="DENY";reason="TRANSITION_NOT_ALLOWED";}
 }
 return {ok:true,environment:input.environment,mode:"INCIDENT_POLICY_ONLY",executionAllowed:false,incident:{id:i.id,state:i.state,nextState,severity:i.severity,ownerAssigned:assigned,createdAt:i.createdAt},sla:{targetMinutes:sla,elapsedMinutes:elapsed,breached:slaBreached,needsEscalation:slaBreached},decision,reason,allowedTransitions:permitted[i.state],events:input.events.slice(-20).map(safeEvent)};
}
return Object.freeze({evaluateIncident});
});