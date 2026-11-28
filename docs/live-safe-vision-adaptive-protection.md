# LIVE Safe Vision — Nexus Supra adaptive protection

## Objective
Prefer the least disruptive protection that reliably protects viewers: targeted blur, expanded blur, full-frame shield, then LIVE pause when required. A mask is never a substitute for stopping an imminent dangerous event or a policy that requires interruption.

## Viewer-path requirements (not implemented by this contract)
- Process or transform media before it reaches every viewer; no client-only overlay.
- Bind masks to tracked targets across frames; widen mask when confidence/tracking degrades.
- Validate the transformed output, not only the model decision.
- If detector, media transform, delivery, or enforcement health fails, fail closed to a full-frame shield and escalate to pause if safe shielding cannot be verified.
- Maintain bounded latency and test the p95/p99 detection-to-protection path.
- Do not expose unmasked source to alternate viewer paths, recordings, clips, replays, thumbnails, or guest feeds.
- Protect source media and incident evidence with strict access, minimization, retention and audit controls.

## Adaptive policy
1. Critical/imminent danger: pause LIVE.
2. High-confidence localized target with reliable tracking and policy permission: targeted blur.
3. Uncertain localization: expanded blur.
4. Detector/enforcement unhealthy or invalid signal: full-frame shield; pause if shielding cannot be verified.
5. Context (education, medical, journalism, documentary, fiction) is reviewed as context, not an automatic exemption.
6. Low-confidence/low-risk signals avoid punitive enforcement; collect additional signal or human review.
7. Gifts/monetization controls are a separate risk decision and must not be coupled to blur by default.

## Status
Contract only. This does not implement media transformation, detectors, transport, persistence, viewer fan-out, enforcement, auth/tenant controls, moderator UI or end-to-end safety tests.
