import { procheliaV7 as v7 } from './v7.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}});
export async function handleV7Route(request,env,path){
 const method=request.method.toUpperCase();
 if(path==='/api/v7/status'&&method==='GET')return json({ok:true,version:v7.version,module:'PROCHÉLIA V7',mode:'additif',destructif:false,status:'ready'});
 const routes={
 '/api/v7/check/email':b=>{const email=v7.normalizeEmail(b.email);const ok=v7.isValidEmail(email);return {body:ok?{ok:true,email}:{ok:false,error:'E-mail invalide'},status:ok?200:400};},
 '/api/v7/check/account':b=>wrap(v7.checkAccount(b.account)),
 '/api/v7/check/permissions':b=>wrap(v7.checkPermissions(b)),
 '/api/v7/check/intervenant':b=>wrap(v7.checkIntervenantProfile(b.profile)),
 '/api/v7/check/document':b=>wrap(v7.checkDocument(b.document)),
 '/api/v7/check/expiration':b=>({body:{ok:true,version:v7.version,...v7.checkExpiration(b.date)},status:200}),
 '/api/v7/check/transport':b=>wrap(v7.checkTransport(b.profile)),
 '/api/v7/check/mission':b=>wrap(v7.checkMission(b.mission)),
 '/api/v7/check/mission-transition':b=>wrap(v7.checkMissionTransition(b.currentStatus,b.nextStatus)),
 '/api/v7/check/availability':b=>wrap(v7.checkAvailability(b)),
 '/api/v7/check/conflict':b=>wrap(v7.checkConflict(b),409),
 '/api/v7/check/pricing':b=>wrap(v7.checkPricing(b)),
 '/api/v7/check/qr':b=>wrap(v7.checkQr(b.mission,b.qr)),
 '/api/v7/check/payment':b=>wrap(v7.checkPayment(b.payment)),
 '/api/v7/finance/calculate':b=>wrap(v7.calculateFinance(b)),
 '/api/v7/check/pre-mission':b=>wrap(v7.preMissionCheck(b)),
 '/api/v7/security/idempotency':b=>wrap(v7.checkIdempotency(b.idempotencyKey))
 };
 if(path==='/api/v7/security/audit'&&method==='POST')return json({ok:false,version:v7.version,error:'AUTHENTICATED_AUDIT_ENDPOINT_REQUIRED'},403);
 if(path==='/api/v7/strategy/indicators'&&method==='POST')return json({ok:false,version:v7.version,error:'USE_SERVER_DERIVED_STRATEGIC_INDICATORS'},403);
 const fn=routes[path];if(!fn)return null;if(method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
 let b;try{b=await request.json();}catch{return json({ok:false,error:'INVALID_JSON'},400);}if(!b||typeof b!=='object'||Array.isArray(b))return json({ok:false,error:'INVALID_BODY'},400);
 try{const r=fn(b);return json(r.body,r.status);}catch{return json({ok:false,version:v7.version,error:'V7_VALIDATION_ERROR'},400);}
}
function wrap(r,fallback=400){return {body:r,status:r.ok?200:(r.error==='Conflit détecté'?409:fallback)};}
