/* Machine-readable territory/activity matrix guard. Metadata validation only; never certifies law or enables launch. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusTerritoryActivityMatrix=api;})(typeof window!=="undefined"?window:globalThis,function(){"use strict";
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const STATUS=new Set(["SOURCE_REGISTERED","NOT_RESEARCHED"]);
const COVERAGE=new Set(["PARTIAL_SOURCE_REGISTER","NOT_RESEARCHED"]);
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function date(v){if(typeof v!=="string"||!DATE.test(v))return false;const d=new Date(v+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v}
function fail(reason){return{ok:false,status:"BLOCKED",reason,marketActivationAllowed:false,legalReviewRequired:true,controlImplementationVerified:false}}
function evaluate(matrix,register,now){
 if(!plain(matrix)||!plain(register)||!Array.isArray(matrix.territoriesNotResearched)||!date(now)||!date(matrix.checkedAt)||!date(matrix.reviewDueAt)||!date(register.checkedAt)||matrix.checkedAt>now||matrix.reviewDueAt<now||matrix.marketActivationAllowed!==false||matrix.legalReviewStatus!=="PENDING_COUNSEL"||matrix.controlImplementationStatus!=="UNVERIFIED"||matrix.owner!=="LEGAL_COMPLIANCE"||matrix.reviewer!=="AUTOMATED_SOURCE_DISCOVERY"||matrix.sourceRegisterVersion!==register.registerVersion)return fail("MATRIX_METADATA_INVALID_OR_STALE");
 const expectedTerritories=["FR","EU","DZ","BE","CH","LU","CA","MA","TN","ES","IT","DE","GB","US","AE","OTHER"];
 const expectedCategories=["consumer_platform","precontract","pricing_fees","cancellation_refund","complaints_mediation","reviews_fair_practices","DSA","trader_traceability","tax_DAC7","privacy","retention_rights","processor_contracts_transfers","DPIA","professional_qualifications_insurance","payments_PSP","security","AI_governance","local_licensing","labor_platform_work","advertising_competition"];
 const expectedActivities=["SERVICE_MARKETPLACE_INTERMEDIATION","DIRECT_SERVICE_PROVIDER","B2B_SERVICE_CONTRACT","PAYMENTS_PSP_PAYOUTS","DIGITAL_PLATFORM"];
 if(!Array.isArray(matrix.territories)||matrix.territories.length!==expectedTerritories.length||!Array.isArray(matrix.requiredCategories)||!Array.isArray(matrix.activityModels)||matrix.requiredCategories.join("|")!==expectedCategories.join("|")||matrix.activityModels.join("|")!==expectedActivities.join("|"))return fail("MATRIX_COVERAGE_INVALID");
 const sourceIds=new Set((register.sources||[]).map(s=>s.sourceId));
 const codes=new Set(),notResearched=[];
 for(const t of matrix.territories){
  if(!plain(t)||!expectedTerritories.includes(t.code)||codes.has(t.code)||!COVERAGE.has(t.coverageStatus)||t.marketActivationAllowed!==false||t.controlImplementationStatus!=="UNVERIFIED"||!date(t.reviewDueAt)||t.reviewDueAt<now||!plain(t.categories)||!plain(t.activityAssessments))return fail("TERRITORY_ROW_INVALID");
  codes.add(t.code);
  if(t.coverageStatus==="NOT_RESEARCHED")notResearched.push(t.code);
  if(!Array.isArray(t.sourceIds)||new Set(t.sourceIds).size!==t.sourceIds.length||t.sourceIds.some(id=>!sourceIds.has(id)))return fail("TERRITORY_SOURCE_REFERENCE_INVALID");
  if(Object.keys(t.categories).sort().join("|")!==expectedCategories.slice().sort().join("|"))return fail("CATEGORY_COVERAGE_INVALID");
  const referenced=new Set();
  for(const key of expectedCategories){
   const c=t.categories[key];
   if(!plain(c)||!STATUS.has(c.status)||!Array.isArray(c.sourceIds)||new Set(c.sourceIds).size!==c.sourceIds.length||c.sourceIds.some(id=>!sourceIds.has(id))||c.controlImplementationStatus!=="UNVERIFIED"||!date(c.reviewDueAt)||c.reviewDueAt<now||typeof c.evidenceNote!=="string"||c.evidenceNote.length<20)return fail("CATEGORY_ROW_INVALID");
   if((c.status==="SOURCE_REGISTERED")!== (c.sourceIds.length>0))return fail("CATEGORY_SOURCE_STATUS_MISMATCH");
   if(c.sourceIds.some(id=>!t.sourceIds.includes(id)))return fail("CATEGORY_TERRITORY_SOURCE_MISMATCH");
   c.sourceIds.forEach(id=>referenced.add(id));
  }
  if([...referenced].some(id=>!t.sourceIds.includes(id)))return fail("TERRITORY_SOURCE_SET_MISMATCH");
  if(t.coverageStatus==="NOT_RESEARCHED"&&(t.sourceIds.length||expectedCategories.some(k=>t.categories[k].status!=="NOT_RESEARCHED")))return fail("UNRESEARCHED_TERRITORY_HAS_SOURCES");
  if(t.coverageStatus==="PARTIAL_SOURCE_REGISTER"&&t.legalReviewStatus!=="PENDING_COUNSEL"&&t.legalReviewStatus!=="PENDING_LOCAL_COUNSEL")return fail("LEGAL_REVIEW_STATUS_INVALID");
  if(Object.keys(t.activityAssessments).sort().join("|")!==expectedActivities.slice().sort().join("|"))return fail("ACTIVITY_COVERAGE_INVALID");
  for(const activity of expectedActivities){const a=t.activityAssessments[activity];if(!plain(a)||a.status!=="UNVERIFIED"||a.marketActivationAllowed!==false||a.controlImplementationStatus!=="UNVERIFIED"||!Array.isArray(a.evidenceReferences)||a.evidenceReferences.length!==0)return fail("ACTIVITY_ASSESSMENT_INVALID");}
 }
 if([...codes].sort().join("|")!==expectedTerritories.slice().sort().join("|")||matrix.territoriesNotResearched.slice().sort().join("|")!==notResearched.slice().sort().join("|"))return fail("TERRITORY_LIST_MISMATCH");
 return{ok:true,status:"MATRIX_METADATA_VALID",marketActivationAllowed:false,legalReviewRequired:true,controlImplementationVerified:false,territoryCount:matrix.territories.length,notResearchedTerritories:notResearched,registeredSourceReferences:matrix.territories.reduce((n,t)=>n+t.sourceIds.length,0),activityModelCount:expectedActivities.length,categoryCount:expectedCategories.length};
}
return{evaluate,date};
});
