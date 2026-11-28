# LIVE Safe Vision — Runtime Acceptance Gates

**Status: NO-GO until every applicable gate has evidence.** This document is an acceptance checklist, not proof that the runtime exists or is validated.

## 1. Media ingress and source integrity
- [ ] Identify the production media ingress path(s), protocols, codec handling, frame/audio extraction, and ownership.
- [ ] Establish immutable stream, room, participant, session, frame, timestamp, and policy-version context.
- [ ] Reject missing, malformed, stale, duplicated, reordered, or cross-room context.
- [ ] Ensure untrusted clients cannot forge detector outputs, protection attestations, pause acknowledgements, or moderator decisions.
- [ ] Confirm source media is never accessible to viewer-facing paths before protection.

## 2. Detection and tracking
- [ ] Real detector is integrated; model/version and configuration are recorded.
- [ ] Detection covers the agreed policy categories and supported media types.
- [ ] Tracking continuity, confidence calibration, occlusion, scene changes, and multiple targets are tested.
- [ ] Detector timeout, crash, overload, malformed output, and model unavailable produce fail-closed behavior.
- [ ] Context classification is evidence-based and does not bypass protection.

## 3. Transformation and output verification
- [ ] Targeted masks only when localization is validated; uncertainty escalates to expanded or full-frame shield.
- [ ] Transform is applied to the actual output frame/audio, not merely represented by a plan.
- [ ] Output is independently checked for transform success and correct frame identity.
- [ ] No raw source leaks through thumbnails, previews, guest paths, recordings, clips, replays, snapshots, caches, or alternate transports.
- [ ] Transform failure, mismatch, or unverified output blocks release and escalates to shield/pause.

## 4. Release gate and fan-out
- [ ] Every viewer-bound path passes through the same mandatory protection gate.
- [ ] Gate cannot be bypassed by retry, reconnect, failover, alternate worker, or direct origin.
- [ ] Protection evidence is authenticated, short-lived, stream/frame-bound, policy-bound, and replay-resistant.
- [ ] Fan-out occurs only after verified protection.
- [ ] If shield/pause cannot be confirmed, the stream is stopped and release remains blocked.

## 5. Runtime resilience and abuse tests
- [ ] Detector unavailable; transform unavailable; verification unavailable.
- [ ] Worker restart, queue saturation, backpressure, packet/frame loss, latency spike.
- [ ] Reordered frames, stale frames, replayed attestations, cross-tenant and cross-room substitution.
- [ ] Multi-target, boundary conditions, low confidence, occlusion, rapid movement, scene transition.
- [ ] Race between moderation action and viewer release.
- [ ] Alternate output paths and recording pipeline tested.
- [ ] Red-team test suite and regression fixtures are versioned and reproducible.

## 6. Human governance and incidents
- [ ] Moderator console shows safe, actionable evidence without unnecessary sensitive data.
- [ ] Severe sanctions are reviewable; appeals and reversals are tracked.
- [ ] Incident records have access controls, retention limits, audit trail, and legal hold rules.
- [ ] Escalation, pause/resume, and recovery require authorized actors and durable records.
- [ ] Policy updates are versioned, reviewed, tested, and rollback-capable.

## 7. Privacy, legal, and operational controls
- [ ] Data minimization and retention by media category are documented.
- [ ] DPIA/privacy review, lawful basis, notices, rights handling, processor contracts, and cross-border transfers assessed.
- [ ] Security logging avoids raw media and secrets; access and deletion are audited.
- [ ] Performance measured on representative traffic and hardware/edge conditions.
- [ ] p50/p95/p99 detection-to-protection, verification, and release latency; false positives/negatives; shield rate; availability; exposure incidents measured.
- [ ] SLOs are set from empirical evidence and risk analysis, not assumed constants.

## 8. Release evidence package
- [ ] Architecture/data-flow diagram and threat model.
- [ ] Test reports, benchmark methodology, reproducible fixtures, and red-team findings.
- [ ] Security/privacy/legal sign-offs and unresolved-risk register.
- [ ] Rollback plan, kill switch, incident playbook, owner/on-call coverage.
- [ ] Independent acceptance review.

**Release decision:** NO-GO if any critical gate is incomplete, evidence is missing, or an unsafe bypass is found. Contract tests alone do not establish operational protection.
