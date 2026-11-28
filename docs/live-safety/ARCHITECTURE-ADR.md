# PROCHÉLIA LIVE — Architecture decision record (ADR)

**Status:** proposed / draft PR only — no provider credentials, runtime integration, deployment, or LIVE launch.
**Date:** 2026-11-28
**Goal:** build a real-time LIVE experience with safety controls as a launch prerequisite.

## 1. Audit baseline
The API and frontend repositories inspected for PR #479 did not evidence a complete LIVE transport, realtime audio/video/chat moderation, verified-age gate, stream interruption, guest controls, monetization lock, case-review UI, or appeal workflow. Existing generic reporting/incident functions are not a substitute. This remains **NO-GO for LIVE**.

## 2. Transport decision — candidate
Evaluate Cloudflare Realtime SFU for interactive low-latency LIVE transport, with application-controlled signaling, publication/subscription permissions, and a WebSocket media adapter for moderation processing. Cloudflare Stream Live WebRTC may be evaluated as a managed broadcast/delivery option, but must not be assumed to provide PROCHÉLIA's safety pipeline.

**Why Realtime SFU is the preferred candidate:** it provides control over publishers/subscribers and supports media adapters; the backend retains identity, permissions, state and credential control. This permits an independently managed moderation subscriber without trusting the browser. Provider capability, latency, regional availability, pricing, concurrency and failure behavior must be validated before selection.

**No final vendor lock-in:** define a provider-neutral interface and adapter contract. A second provider is not required for launch, but the system must fail closed and support a documented migration.

## 3. Trust boundaries and components
1. **Client**: capture media, UI, accessibility, report button. No enforcement authority and no provider secrets.
2. **API authorization layer**: authenticated user, tenant/host eligibility, age assurance result, sanctions, territory policy, consent, quotas, and entitlement checks. It issues narrowly scoped, short-lived connection credentials.
3. **LIVE Room state service**: authoritative room lifecycle, participant/guest roles, versioned state, leases, ordering, idempotency and cleanup. Every mutation checks ownership and membership.
4. **Media transport adapter**: provider integration for publish/subscribe and server-side moderation media copy. Credentials server-only. Browser-supplied stream IDs are not authorization.
5. **Safety pipeline** (independent of provider): video sampling/object/activity/context; audio speech recognition, language detection, acoustic signals and speaker attribution; chat/gift/report analysis; signal fusion, confidence calibration, temporal persistence, territory/context rules.
6. **Enforcement service**: ordered, idempotent commands; provider health/latency watchdog; pause, blur/mute, remove guest, end LIVE, block gifts, revoke credentials, cooldown and account restrictions. Provider adapter must confirm action outcome.
7. **Case & evidence service**: restricted evidence references, event timeline, policy/model versions, reason codes, review assignment, appeal and restoration. Evidence encrypted, access logged, retention limited, never public URLs.
8. **Human Safety Console**: role-scoped queues, urgent escalation, two-person review for severe permanent sanctions where feasible, emergency kill switch, reviewer conflict controls and appeals.
9. **Nexus Supra**: orchestration/triage, provider health, queue priorities, analytics, risk patterns, policy routing, explanation drafts and operational escalation. It cannot override hard safety gates, invent evidence, or autonomously impose irreversible sanctions based only on uncertain AI signals.

## 4. Lifecycle (server-authoritative)
REQUESTED → PRECHECK → SAFETY_READY → STARTING → LIVE → PAUSED_SAFETY | PAUSED_TECH → ENDING → ENDED
- Every transition is versioned and audit logged; compare-and-swap state version prevents stale commands.
- Start requires verified eligibility, territory policy, safety services healthy, moderation adapter connected, guest controls ready, chat/report controls ready, monetization disabled until all independent checks pass.
- Safety pause is immediate; resume requires fresh health checks and, for severe events, review/host acknowledgement.
- End closes provider tracks/session, revokes short-lived credentials, removes room discovery, stops gifts and verifies cleanup.
- Reconnect is bounded; stale sessions cannot publish/subscriber after replacement. Repeated reconnect or provider instability triggers pause/end.

## 5. Moderation response policy (detector performance not yet validated)
**High-confidence severe prohibited event:** pause/terminate LIVE immediately, block monetization/gifts, isolate/remove guest where applicable, create a restricted case, notify creator with a clear reason and appeal route. Severe permanent account action is reviewable and appealable.
**Uncertain event:** safety pause/temporary blur/mute or limited distribution as risk requires, route to human review; never permanent punishment from a single low-confidence signal.
**Educational/news/medical/prevention context:** preserve contextual review; age restriction/distribution control as appropriate. No keyword-only enforcement.
**Nicotine/tobacco/alcohol:** territory-specific policy, progressive enforcement, age/context restrictions; no promotional/consumption LIVE where prohibited by policy.
**Minor safety:** verified LIVE host age eligibility, gifts/monetization controls, special rules if a minor appears, no grooming, private contact exploitation, or unsafe guest access.
**Gifts:** stop on safety incident, suspicious coercion, manipulation, scam, minors, or provider failure; no gambling-like reward mechanics.

## 6. Streaming moderation contract
Normalized signal fields:
- signal_id, stream_id, room_version, actor_id/actor_type, category, severity, confidence, modality, observed_at, territory, context_flags, provider_id, model_version, policy_version, evidence_ref, expires_at.
Signals are signed/authenticated, replay-protected, tenant-scoped, schema-validated, rate-limited, and idempotent. Evidence refs are opaque and access-controlled.
Categories include drugs/controlled substances, smoking/nicotine, alcohol, dangerous acts, violence/threats, sexual exploitation, child safety/grooming, self-harm, hate/harassment, doxxing, scams/gift manipulation, copyright/rebroadcast, and contextual exceptions.
A model score is not a legal conclusion. Thresholds must be calibrated by category, language, modality and context with measured false-positive/false-negative rates.

## 7. Fail-closed and SLO gates (initial targets; validate by measurement)
- No LIVE start if age/eligibility or safety provider health is unknown.
- Safety signal ingestion-to-protective-action target: p95 ≤ 2 seconds; p99 ≤ 5 seconds, with per-category thresholds and tested watchdog. These are initial engineering targets, not measured results.
- Moderation heartbeat/health timeout, queue backlog beyond configured budget, media adapter disconnect, enforcement API failure, or safety pipeline outage: pause LIVE; if not recoverable within bounded grace period, end LIVE.
- A successful API response is not proof of media delivery or enforcement. Confirm provider state and client playback/state.
- Every action has idempotency key, reason code, actor/service identity, result, timestamps, correlation ID and audit event.
- Safety system must not be bypassable by changing title, camera, guest, reconnect, stream key, language, or chat mode.

## 8. Privacy and legal gates
- Data protection impact assessment where required; purpose limitation; data minimization; lawful basis; user notices; provider DPAs/subprocessors; international transfer review; territory retention matrix.
- Avoid biometric identification. Age assurance must be proportionate, lawful, privacy-minimizing, independently assessed and never store raw identity artifacts longer than necessary.
- No raw media retained by default for moderation. Store narrowly scoped clips/frames/audio snippets only when legally justified, encrypted, access-controlled, retention-limited, and tied to case/appeal. Document deletion propagation.
- Moderators see only evidence needed for the case. No evidence in logs, analytics, public links, or model prompts without controls.
- Legal policy matrix must be reviewed by counsel per launch country and activity; this ADR is not legal certification.

## 9. Release acceptance — all required
1. Verified age/eligibility and territory rules; fraud/age-assurance abuse tests.
2. Real transport integration in isolated staging, no mock-only acceptance.
3. Real moderation stream copy for video/audio/chat and provider health.
4. End-to-end enforcement proven: signal → protective action on actual LIVE → gifts disabled → notice → case → appeal → restore/reject.
5. Guest controls and host/guest attribution.
6. Multilingual, slang, low-light, smoke, contextual educational/news, false-positive and adversarial evasion test set; independent review of metrics.
7. Chaos: provider outage, adapter disconnect, delay, packet loss, queue saturation, webhook spoof/replay, duplicate events, reconnect, race conditions and stale session.
8. Privacy/DPIA, retention/deletion, security penetration test, tenant isolation, incident response and on-call runbook.
9. Moderation operations, appeal SLA, reviewer training, transparency reporting and policy-change process.
10. Cost and capacity benchmark, rate limits, quotas, abuse controls, load/soak tests, disaster recovery.
11. Accessibility, UX comprehension, creator notice, viewer report flow and transparent safety status.
12. Release sign-off by engineering, security, Trust & Safety, privacy/legal and operations. No launch before sign-off.

## 10. Implementation sequence (dependency-ordered)
**A — Foundation:** provider-neutral contracts, LIVE lifecycle state machine, authorization/tenant checks, event/audit schemas, room state, cleanup/idempotency.
**B — Transport:** isolated Cloudflare Realtime SFU app and server-side adapter; media publish/subscribe; credential issuance; room/guest lifecycle; observability.
**C — Safety:** moderation media adapter; detector providers; fusion/calibration; watchdog; enforcement adapter; case/evidence storage.
**D — Product:** creator safety panel, guest controls, report flow, viewer protections, notices, appeal UI, monetization lock.
**E — Validation:** synthetic and consented red-team dataset, E2E/chaos/latency/accuracy tests, privacy and legal review, operational drills.
**F — Controlled pilot:** invitation-only, adults-only, limited territories, no gifts initially; graduated enablement only after measured safety performance.

## 11. Current status
This ADR is a design decision proposal. It is not implementation evidence. Policy-only PR #479 remains draft and is not merged. Preview build/deployment is not production. LIVE stays NO-GO.
