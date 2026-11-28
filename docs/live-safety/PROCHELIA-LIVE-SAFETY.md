# PROCHÉLIA LIVE — safety/moderation specification
**Audit status:** candidate policy; no live-stream product or real-time moderation stack is evidenced in the inspected API/frontend repository.

## Rules
**Immediate stop:** drug/controlled substance use, display or sale/promotion; child sexual exploitation; credible threats; sexual exploitation; weapon threats; imminent self-harm; doxxing/private data exposure.
**Interrupt/restrict:** tobacco/nicotine/vaping, alcohol intoxication/promotion (territory/age policy), dangerous challenges, hate/harassment, scams/gift manipulation, graphic violence, sexualized content, unauthorized rebroadcast.
**Context review:** education, medical, news, prevention/documentary may be allowed with verified context, age restriction, distribution controls and human review. Never ban based on a keyword/object alone.

## Smoking/drugs example
1. Detect via multimodal signals (video frames + ASR/audio + chat), contextual fusion, confidence, persistence and jurisdiction policy.
2. High-confidence prohibited drug activity: interrupt LIVE, block gifts/monetization, create restricted review case, notify creator with reason; LIVE privilege cooldown pending review.
3. Ambiguous signal: pause/blur/mute and human review; avoid irreversible sanctions from uncertain model output.
4. Guest violation: remove guest; interrupt; end stream if host continues or violation persists.
5. Appeals: timestamp/category, policy/model versions, evidence reference, reviewer, decision and restoration path.

## Required realtime components
- Audio speech-to-text, multilingual policy classifier, threats/self-harm/harassment detection, speaker diarization.
- Video object/activity/context detection; no biometric identity recognition. Age assurance must be lawful, privacy-minimizing and independently assessed.
- Chat spam/scam/grooming/doxxing detection, slow mode, rate limits, anti-brigading.
- Signal fusion, calibrated category thresholds, false-positive/negative metrics and temporal context.
- Enforcement APIs: warn, slow mode, mute chat/audio, blur, remove guest, pause, end LIVE, cooldown, strike/suspension, monetization freeze. Idempotent and auditable.
- Safety watchdog: moderation provider outage, latency, dropped frames, queue backlog, enforcement failure => fail closed; LIVE pauses/ends.
- Human moderation console, scoped moderator roles, emergency stop, appeals, reviewer separation, abuse controls.
- One-tap reports with reason, timestamp, status/outcome and privacy safeguards.
- Minors: verified 18+ host eligibility, gifts restricted; special rules if minors appear; no grooming/private contact/monetization exploitation.
- Gifts: prohibit coercive prompts, fake urgency, gambling-like rewards, manipulation and gifts from minors.
- GDPR: minimize/encrypt evidence, role-limited access, retention/deletion schedule, DPIA as required, provider DPA and regional data controls.

## Test/release gates
Cover drugs, nicotine, alcohol, weapons, violence, sexual content, child safety, grooming, self-harm, hate, harassment, doxxing, scams, gift manipulation, copyright; host/guest; languages/slang; false positives (medical/education/news); outages, latency, reconnect/evasion, report storms, appeals and restoration. E2E must prove detection -> real stream interruption -> creator notice -> case -> appeal -> restore. No launch before provider contracts, jurisdiction matrix, operational on-call and measured moderation latency/accuracy.

## Nexus Supra
Nexus Supra coordinates provider health, risk signals, case prioritization, explanations, monitoring and escalation. It cannot promise 100% detection or certify legality. Immediate temporary interruption can protect users; severe account sanctions require review and appeal.

## Suggested event contract
`live_safety_signal`: stream_id, actor_id/type, category, confidence, severity, modality, timestamp, evidence_ref, policy_version, model_version, territory, context_flags.
`live_moderation_case`: case_id, stream_id, reason_code, action, status, reviewer_id, appeal_id, evidence_refs, policy/model versions, timestamps.
Tenant isolation, signed provider callbacks, anti-replay, idempotency, immutable audit, no public evidence URLs.

## Findings
Repository inspection found no LIVE streaming implementation, realtime moderation, stream interrupt, age gating, guest moderation console or LIVE appeals workflow. Generic reporting/incident handling exists but does not provide these protections. Critical blocker before LIVE launch.
