// PROCHÉLIA market-readiness catalogue v1.
 // Planning catalogue only: no country is enabled or legally assessed.
const GATES = Object.freeze([
  "legal_review","tax_and_accounting_review","payment_provider_validation","kyc_aml_validation",
  "consumer_protection_review","worker_classification_review","contracts_and_terms_review",
  "privacy_and_data_transfer_review","data_residency_review","insurance_and_licensing_review",
  "language_and_accessibility_review","support_and_dispute_resolution_review",
  "safety_and_emergency_review","local_operations_validation"
]);
const MARKET_ROWS = [
  {code:"FR",name:"France",nameEn:"France",currency:"EUR",locales:["fr-FR"],languages:["fr"],phase:"initial_candidate",measurementSystem:"metric"},
  {code:"DZ",name:"Algérie",nameEn:"Algeria",currency:"DZD",locales:["ar-DZ","fr-DZ"],languages:["ar","fr"],phase:"initial_candidate",measurementSystem:"metric"},
  {code:"BE",name:"Belgique",nameEn:"Belgium",currency:"EUR",locales:["fr-BE","nl-BE","de-BE"],languages:["fr","nl","de"],phase:"expansion_candidate",measurementSystem:"metric"},
  {code:"CH",name:"Suisse",nameEn:"Switzerland",currency:"CHF",locales:["de-CH","fr-CH","it-CH"],languages:["de","fr","it"],phase:"expansion_candidate",measurementSystem:"metric"},
  {code:"LU",name:"Luxembourg",nameEn:"Luxembourg",currency:"EUR",locales:["lb-LU","fr-LU","de-LU"],languages:["lb","fr","de"],phase:"expansion_candidate",measurementSystem:"metric"},
  {code:"CA",name:"Canada",nameEn:"Canada",currency:"CAD",locales:["en-CA","fr-CA"],languages:["en","fr"],phase:"expansion_candidate",measurementSystem:"metric"},
  {code:"MA",name:"Maroc",nameEn:"Morocco",currency:"MAD",locales:["ar-MA","fr-MA"],languages:["ar","fr"],phase:"expansion_candidate",measurementSystem:"metric"},
  {code:"TN",name:"Tunisie",nameEn:"Tunisia",currency:"TND",locales:["ar-TN","fr-TN"],languages:["ar","fr"],phase:"expansion_candidate",measurementSystem:"metric"},
  {code:"ES",name:"Espagne",nameEn:"Spain",currency:"EUR",locales:["es-ES"],languages:["es"],phase:"expansion_candidate",measurementSystem:"metric"},
  {code:"IT",name:"Italie",nameEn:"Italy",currency:"EUR",locales:["it-IT"],languages:["it"],phase:"expansion_candidate",measurementSystem:"metric"},
  {code:"DE",name:"Allemagne",nameEn:"Germany",currency:"EUR",locales:["de-DE"],languages:["de"],phase:"expansion_candidate",measurementSystem:"metric"},
  {code:"GB",name:"Royaume-Uni",nameEn:"United Kingdom",currency:"GBP",locales:["en-GB"],languages:["en"],phase:"expansion_candidate",measurementSystem:"mixed"},
  {code:"US",name:"États-Unis",nameEn:"United States",currency:"USD",locales:["en-US"],languages:["en"],phase:"expansion_candidate",measurementSystem:"us_customary"},
  {code:"AE",name:"Émirats arabes unis",nameEn:"United Arab Emirates",currency:"AED",locales:["ar-AE","en-AE"],languages:["ar","en"],phase:"expansion_candidate",measurementSystem:"metric"}
];
const MARKETS = Object.freeze(MARKET_ROWS.map(row => Object.freeze({...row,readiness:"NOT_ASSESSED",launchEnabled:false,timeZonePolicy:"IANA_TIME_ZONE_REQUIRED_PER_SERVICE_LOCATION",gates:Object.freeze(GATES.map(key=>Object.freeze({key,status:"PENDING_HUMAN_VALIDATION"}))),lastReviewedAt:null})));
function marketReadinessPayload(countryCode){
 const requested=countryCode==null?null:String(countryCode).trim().toUpperCase();
 const markets=requested?MARKETS.filter(m=>m.code===requested):MARKETS;
 return {schemaVersion:1,catalogueType:"CANDIDATE_MARKETS_NOT_LAUNCH_APPROVAL",launchEnabled:false,requiredHumanApproval:true,markets};
}
const FORMAT_SAMPLE_DATE = new Date("2026-01-02T15:04:05.000Z");
export function marketLocalizationPayload(countryCode){
 const requested=String(countryCode??"").trim().toUpperCase();
 const market=MARKETS.find(m=>m.code===requested);
 if(!market)return null;
 const locale=market.locales[0];
 const numberFormatter=new Intl.NumberFormat(locale);
 const currencyFormatter=new Intl.NumberFormat(locale,{style:"currency",currency:market.currency});
 const dateFormatter=new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeZone:"UTC"});
 const timeFormatter=new Intl.DateTimeFormat(locale,{timeStyle:"medium",timeZone:"UTC"});
 return {
  schemaVersion:1,
  catalogueType:"LOCALIZATION_DEFAULTS_NOT_LEGAL_OR_LAUNCH_APPROVAL",
  countryCode:market.code,
  name:market.name,
  nameEn:market.nameEn,
  locales:[...market.locales],
  languages:[...market.languages],
  preferredLocale:locale,
  currency:market.currency,
  currencyFractionDigits:currencyFormatter.resolvedOptions().maximumFractionDigits,
  measurementSystem:market.measurementSystem,
  examples:{number:numberFormatter.format(1234567.89),currency:currencyFormatter.format(1234.56),date:dateFormatter.format(FORMAT_SAMPLE_DATE),time:timeFormatter.format(FORMAT_SAMPLE_DATE),sampleTimeZone:"UTC"},
  timeZone:{required:true,policy:"IANA_TIME_ZONE_REQUIRED_PER_SERVICE_LOCATION",default:null},
  taxConfiguration:{status:"NOT_CONFIGURED",requiresLocalExpertValidation:true},
  readiness:market.readiness,
  launchEnabled:market.launchEnabled,
  requiredHumanApproval:true
 };
}
export function handleMarketReadinessRoute(request){
 const url=new URL(request.url);
 if(url.pathname==="/api/platform/markets"){
  if(request.method!=="GET")return new Response(JSON.stringify({ok:false,error:"METHOD_NOT_ALLOWED"}),{status:405,headers:{"content-type":"application/json; charset=utf-8","allow":"GET","cache-control":"no-store"}});
  const country=url.searchParams.get("country");
  const payload=marketReadinessPayload(country);
  if(country&&payload.markets.length===0)return new Response(JSON.stringify({ok:false,error:"MARKET_NOT_FOUND",country:country.toUpperCase()}),{status:404,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
  return new Response(JSON.stringify({ok:true,...payload}),{status:200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
 }
 const localizationMatch=url.pathname.match(/^\\/api\\/platform\\/markets\\/([a-z]{2})\\/localization$/i);
 if(!localizationMatch)return null;
 if(request.method!=="GET")return new Response(JSON.stringify({ok:false,error:"METHOD_NOT_ALLOWED"}),{status:405,headers:{"content-type":"application/json; charset=utf-8","allow":"GET","cache-control":"no-store"}});
 const localization=marketLocalizationPayload(localizationMatch[1]);
 if(!localization)return new Response(JSON.stringify({ok:false,error:"MARKET_NOT_FOUND",country:localizationMatch[1].toUpperCase()}),{status:404,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
 return new Response(JSON.stringify({ok:true,localization}),{status:200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
}
export {GATES,MARKETS,marketReadinessPayload};
