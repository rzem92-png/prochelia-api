/**
 * Safe Vision latency budget contract.
 * Uses monotonic timestamps supplied by trusted runtime; no media data.
 */
const STAGES=["receivedAt","decisionAt","transformStartedAt","transformCompletedAt","verifiedAt","releasedAt"];
export function evaluateSafeVisionLatency(timing, budgetMs) {
  const fail=reason=>({ok:false,action:"shield_and_pause_review",reason});
  if(!timing||typeof timing!=="object"||!Number.isFinite(budgetMs)||budgetMs<=0) return fail("invalid_budget_or_timing");
  for(const stage of STAGES) if(!Number.isFinite(timing[stage])) return fail("missing_"+stage);
  for(let i=1;i<STAGES.length;i++) if(timing[STAGES[i]]<timing[STAGES[i-1]]) return fail("non_monotonic_"+STAGES[i]);
  const total=timing.releasedAt-timing.receivedAt;
  const decision=timing.decisionAt-timing.receivedAt;
  const transform=timing.transformCompletedAt-timing.transformStartedAt;
  const verify=timing.verifiedAt-timing.transformCompletedAt;
  const release=timing.releasedAt-timing.verifiedAt;
  if(total>budgetMs) return {ok:false,action:"shield_and_pause_review",reason:"latency_budget_exceeded",metrics:{total,decision,transform,verify,release,budgetMs}};
  return {ok:true,action:"release_allowed_after_other_guards",metrics:{total,decision,transform,verify,release,budgetMs}};
}
