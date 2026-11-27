/* Nexus bounded autonomy policy evaluator. Advisory policy result only; does not authorize/execute real actions. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusActionGuard=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENVS=new Set(["preview","development","test"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,CLASSES=new Set(["read_only","reversible","sensitive","financial","irreversible","production"]),MODES=new Set(["observe","suggest","execute"]),ROLES=new Set(["human_owner","human_operator","security_specialist","finance_specialist","compliance_specialist"]);
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function validId(v){return typeof v==="string"&&ID.test(v)}
function invalid(reason="INPUT_INVALID"){return {ok:false,status:"DENIED",reason,policyMode:"ADVISORY_ONLY",actionAuthorized:false,executionAllowed:false,humanReviewRequired:true,approvalsNeeded:null}}
function evaluate(input={}){
 if(!plain(input)||!ENVS.has(input.environment)||!validId(input.tenantId)||!validId(input.actionId)||!validId(input.actorId)||!CLASSES.has(input.actionClass)||!MODES.has(input.requestedMode)||!Array.isArray(input.approvals)||input.approvals.length>10)return invalid();
 const ids=new Set();for(const a of input.approvals){if(!plain(a)||!validId(a.approvalId)||ids.has(a.approvalId)||a.tenantId!==input.tenantId||a.actionId!==input.actionId||!validId(a.approverId)||a.approverId===input.actorId||!ROLES.has(a.role)||a.status!=="approved")return invalid("APPROVAL_INVALID");ids.add(a.approvalId);}
 const uniqueRoles=new Set(input.approvals.map(a=>a.role)),uniquePeople=new Set(input.approvals.map(a=>a.approverId));
 const dualRequired=["sensitive","financial","irreversible"].includes(input.actionClass),requiredRoles=input.actionClass==="financial"?["human_owner","finance_specialist"]:input.actionClass==="sensitive"?["human_owner","security_specialist"]:input.actionClass==="irreversible"?["human_owner","human_operator"]:input.actionClass==="production"?["human_owner","security_specialist","compliance_specialist"]:[];
 const required= input.actionClass==="read_only"?0:input.actionClass==="reversible"?1:2;
 const approvalsMet=requiredRoles.length?requiredRoles.every(r=>uniqueRoles.has(r)):uniquePeople.size>=required;
 const permittedMode=input.actionClass==="read_only"?"observe":input.actionClass==="reversible"?"suggest":"observe";
 const modeAllowed=input.requestedMode==="observe"||input.requestedMode==="suggest"&&(input.actionClass==="read_only"||input.actionClass==="reversible");
 const authorizedHint=approvalsMet&&modeAllowed&&input.actionClass!=="production";
 const status=input.actionClass==="production"?"PRODUCTION_BLOCKED":!approvalsMet?"APPROVALS_REQUIRED":!modeAllowed?"MODE_NOT_PERMITTED":authorizedHint?"POLICY_CHECK_PASSED":"DENIED";
 return {ok:true,status,tenantId:input.tenantId,actionId:input.actionId,actionClass:input.actionClass,requestedMode:input.requestedMode,policyMode:"ADVISORY_ONLY",actionAuthorized:false,executionAllowed:false,humanReviewRequired:true,approvalRequirement:{minimumApprovals:required,requiredRoles,dualApprovalRequired:dualRequired,approvalsMet,approvalCount:uniquePeople.size},recommendedMode:permittedMode,policyCheckPassed:authorizedHint,limitations:["Policy evaluation is advisory and is not an authorization enforcement point.","Real execution must independently enforce RBAC, tenant scope, idempotency, approval freshness, environment and kill-switch checks."]};
}
return Object.freeze({evaluate});
});
