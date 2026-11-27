(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusGovernance=api})(typeof window!=="undefined"?window:globalThis,function(){"use strict";
const MODES=new Set(["OBSERVE","SUGGEST","EXECUTE_APPROVED"]);
const ACTION_CLASSES=new Set(["READ","WRITE","FINANCIAL","PSP","BANKING","PRODUCTION","LEGAL","TAX","SENSITIVE_KYC","PERSONAL_SENSITIVE","IRREVERSIBLE","SECURITY_CHANGE","COUNTRY_ACTIVATION"]);
const APPROVAL_CLASSES=new Set(["FINANCIAL","PSP","BANKING","PRODUCTION","LEGAL","TAX","SENSITIVE_KYC","PERSONAL_SENSITIVE","IRREVERSIBLE","SECURITY_CHANGE","COUNTRY_ACTIVATION"]);
const MONEY_CLASSES=new Set(["FINANCIAL","PSP","BANKING"]);
const BUDGET_KEYS=["maxActionsPerTask","maxCostUnits","maxRetries","maxRuntimeMs"];
function nonEmpty(value){return typeof value==="string"&&value.trim().length>0}
function isCounter(value){return Number.isSafeInteger(value)&&value>=0}
function expiry(value){if(Number.isSafeInteger(value))return value;const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:null}
function object(value){return !!value&&typeof value==="object"&&!Array.isArray(value)}
function validatePolicy(policy){
 if(!object(policy)||!nonEmpty(policy.version)||!MODES.has(policy.mode)||!Array.isArray(policy.allowedEnvironments)||!policy.allowedEnvironments.length||
    !object(policy.killSwitch)||typeof policy.killSwitch.global!=="boolean"||!object(policy.killSwitch.agents)||!object(policy.killSwitch.tools)||!object(policy.killSwitch.tenants)||!object(policy.killSwitch.workflows)||
    !object(policy.agents)||!Array.isArray(policy.approverIds))return false;
 if(policy.approvalRequiredActionClasses!==undefined&&(!Array.isArray(policy.approvalRequiredActionClasses)||!policy.approvalRequiredActionClasses.every(x=>ACTION_CLASSES.has(x))))return false;
 if(policy.approvalRequiredActions!==undefined&&(!Array.isArray(policy.approvalRequiredActions)||!policy.approvalRequiredActions.every(nonEmpty)))return false;
 if(policy.approvalQuorumByClass!==undefined&&(!object(policy.approvalQuorumByClass)||!Object.values(policy.approvalQuorumByClass).every(x=>Number.isSafeInteger(x)&&x>=1&&x<=5)))return false;
 for(const agent of Object.values(policy.agents)){
  if(!object(agent)||typeof agent.enabled!=="boolean"||!Array.isArray(agent.allowedTools)||!Array.isArray(agent.allowedActions)||!Array.isArray(agent.allowedScopes)||!Array.isArray(agent.allowedTenants)||!Array.isArray(agent.allowedEnvironments)||typeof agent.globalTaskAllowed!=="boolean"||!object(agent.budget)||!BUDGET_KEYS.every(key=>isCounter(agent.budget[key])))return false;
 }
 return true;
}
function deny(code,reason,policy,request,decision="DENY"){
 return Object.freeze({allowed:false,decision,code,reason,policyVersion:policy?.version||"UNKNOWN",agentId:request?.agentId||null,toolId:request?.toolId||null,tenantId:request?.tenantId??null,environment:request?.environment||null,approvalRequired:decision==="REQUIRES_APPROVAL"});
}
function allow(code,reason,policy,request,authorization,approvalIds=[]){
 return Object.freeze({allowed:true,decision:authorization==="READ_ONLY"?"ALLOW_READ_ONLY":"ALLOW_EXECUTION",code,reason,policyVersion:policy.version,agentId:request.agentId,toolId:request.toolId,tenantId:request.tenantId??null,environment:request.environment,approvalRequired:approvalIds.length>0,authorization,approvalIds:Object.freeze(approvalIds.slice())});
}
function approvalQuorum(policy,actionClass){
 const override=policy.approvalQuorumByClass?.[actionClass];
 if(Number.isSafeInteger(override)&&override>=1&&override<=5)return override;
 return MONEY_CLASSES.has(actionClass)?2:1;
}
function validApproval(item,policy,request,now){
 if(!object(item)||item.approved!==true||!nonEmpty(item.approvalId)||!nonEmpty(item.approverId)||
    !policy.approverIds.includes(item.approverId)||item.actionHash!==request.actionHash||!nonEmpty(request.actionHash)||!/^[a-f0-9]{64}$/i.test(request.actionHash)||
    item.taskId!==request.taskId||item.tenantId!==(request.tenantId??null)||item.environment!==request.environment||
    item.toolId!==request.toolId||item.action!==request.action||item.consumed===true||item.consumedAt!=null)return false;
 const expiresAt=expiry(item.expiresAt);
 return expiresAt!==null&&expiresAt>now;
}
function evaluateAction(policy,request){
 if(!object(policy)||!object(request))return deny("INVALID_INPUT","Policy et requête structurées sont requises.",policy,request);
 if(!validatePolicy(policy)||!nonEmpty(request.agentId)||!nonEmpty(request.toolId)||!nonEmpty(request.action)||!ACTION_CLASSES.has(request.actionClass)||!nonEmpty(request.environment)||!nonEmpty(request.scope))return deny("INVALID_POLICY_OR_REQUEST","Policy, identité, outil, action, classe de risque ou scope invalide.",policy,request);
 if(request.environment.toLowerCase()==="production")return deny("PRODUCTION_NO_GO","Toute action Production est refusée par ce moteur Preview/dev.",policy,request);
 if(!policy.allowedEnvironments.includes(request.environment))return deny("ENVIRONMENT_DENIED","Environnement hors périmètre de la policy.",policy,request);
 const switches=policy.killSwitch;
 if(switches.global===true||switches.agents[request.agentId]===true||switches.tools[request.toolId]===true||switches.tenants[request.tenantId]===true||switches.workflows[request.workflowId]===true)return deny("KILL_SWITCH_ACTIVE","Un arrêt d'urgence applicable est actif.",policy,request);
 const agent=policy.agents[request.agentId];
 if(!agent||agent.enabled!==true)return deny("AGENT_DISABLED_OR_UNKNOWN","Agent absent ou désactivé.",policy,request);
 if(!agent.allowedTools.includes(request.toolId)||!agent.allowedActions.includes(request.action))return deny("TOOL_OR_ACTION_NOT_GRANTED","Outil ou action non autorisé pour cet agent.",policy,request);
 if(!agent.allowedScopes.includes(request.scope))return deny("SCOPE_DENIED","Scope non autorisé pour cet agent.",policy,request);
 if(!agent.allowedEnvironments.includes(request.environment))return deny("AGENT_ENVIRONMENT_DENIED","Environnement non autorisé pour cet agent.",policy,request);
 if(request.tenantId==null){if(agent.globalTaskAllowed!==true||request.scope!=="global")return deny("GLOBAL_SCOPE_DENIED","Les tâches globales ne sont pas autorisées pour cet agent.",policy,request)}
 else if(!nonEmpty(request.tenantId)||!agent.allowedTenants.includes(request.tenantId))return deny("TENANT_SCOPE_DENIED","Tenant absent ou hors périmètre autorisé.",policy,request);
 const readOnly=request.actionClass==="READ";
 if(!readOnly&&policy.mode!=="EXECUTE_APPROVED")return deny("MODE_NOT_EXECUTABLE","Le mode OBSERVE/SUGGEST interdit les actions mutantes.",policy,request);
 const usage=object(request.usage)?request.usage:{};
 if((request.usage!==undefined&&!object(request.usage))||!isCounter(usage.actionsUsed??0)||!isCounter(usage.costUnits??0)||!isCounter(request.estimatedCostUnits??0)||!isCounter(request.retryAttempt??0)||!isCounter(request.estimatedRuntimeMs??0)||(request.now!==undefined&&!isCounter(request.now)))return deny("INVALID_BUDGET_INPUT","Usage, estimation, retry ou horodatage mal formé; refus fail-closed.",policy,request);
 const budget=agent.budget;
 if(usage.actionsUsed??0>=budget.maxActionsPerTask)return deny("ACTION_BUDGET_EXCEEDED","Quota d'actions par tâche atteint.",policy,request);
 if((usage.costUnits??0)+(request.estimatedCostUnits??0)>budget.maxCostUnits)return deny("COST_BUDGET_EXCEEDED","Budget de coût dépassé.",policy,request);
 if((request.retryAttempt??0)>budget.maxRetries)return deny("RETRY_LIMIT_EXCEEDED","Nombre maximal de retries dépassé.",policy,request);
 if((request.estimatedRuntimeMs??0)>budget.maxRuntimeMs)return deny("RUNTIME_LIMIT_EXCEEDED","Durée d'exécution estimée supérieure au cap.",policy,request);
 if(!readOnly&&(!nonEmpty(request.taskId)||typeof request.idempotencyKey!=="string"||!/^[A-Za-z0-9._:-]{16,128}$/.test(request.idempotencyKey)))return deny("IDEMPOTENCY_REQUIRED","Une tâche et une clé d'idempotence valide sont obligatoires pour toute action mutante.",policy,request);
 const requiresApproval=APPROVAL_CLASSES.has(request.actionClass)||(policy.approvalRequiredActionClasses||[]).includes(request.actionClass)||(policy.approvalRequiredActions||[]).includes(request.toolId+":"+request.action);
 if(readOnly)return allow("READ_ONLY_ALLOWED","Lecture autorisée dans le scope vérifié; aucune mutation n'est permise.",policy,request,"READ_ONLY");
 if(requiresApproval){
  const approvals=request.approvals;
  if(!Array.isArray(approvals)||approvals.length===0)return deny("HUMAN_APPROVAL_REQUIRED","Cette action exige une approbation humaine explicite.",policy,request,"REQUIRES_APPROVAL");
  const now=request.now??Date.now(),ids=new Set(),humans=new Set();
  for(const item of approvals){if(!validApproval(item,policy,request,now)||ids.has(item.approvalId)||humans.has(item.approverId))return deny("APPROVAL_INVALID_OR_REPLAYED","Une approbation est invalide, expirée, hors périmètre ou réutilisée.",policy,request);ids.add(item.approvalId);humans.add(item.approverId)}
  const quorum=approvalQuorum(policy,request.actionClass);
  if(approvals.length<quorum)return deny("HUMAN_APPROVAL_REQUIRED","Nombre d'approbations humaines insuffisant ("+approvals.length+"/"+quorum+").",policy,request,"REQUIRES_APPROVAL");
  return allow("APPROVED_ACTION_ALLOWED","Policy autorise l'action Preview après validations humaines; le moteur ne l'exécute pas.",policy,request,"EXECUTE",Array.from(ids));
 }
 return allow("EXECUTION_ALLOWED","Policy autorise une action Preview bornée; le moteur ne l'exécute pas.",policy,request,"EXECUTE");
}
return Object.freeze({MODES:Object.freeze(Array.from(MODES)),ACTION_CLASSES:Object.freeze(Array.from(ACTION_CLASSES)),validatePolicy,evaluateAction});
});
