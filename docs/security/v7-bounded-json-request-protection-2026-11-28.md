# V7 bounded JSON request protection — 2026-11-28

## Scope
V7 validator/calculator POST routes are stateless helpers, not authorization for business operations. They must not accept unbounded request bodies or malformed JSON types.

## Change in this draft
- Require `application/json` or a structured `+json` media type for V7 POSTs.
- Apply a 65,536-byte cap based on declared content length and actual streamed body bytes.
- Reject oversized input with HTTP 413 / `REQUEST_BODY_TOO_LARGE`.
- Reject missing body, malformed UTF-8/JSON, JSON arrays and primitives deterministically.
- Only forward a reconstructed bounded request to the existing V7 route handlers.
- No change to GET/status behavior; no business writes are introduced.

## Tests added
- wrong/missing content type -> 415
- malformed JSON -> 400
- non-object JSON -> 400
- oversized streamed request -> 413
- valid bounded JSON -> accepted and readable by existing route handlers

## Remaining hardening
- Route-specific strict schemas and unknown-field rejection still need implementation.
- Authenticated business authorization must remain separate from validator success.
- Other API route families require their own size/schema inventory; this guard applies only to V7.

## Safety
No production deploy, secrets, remote migration, or data write. Draft PR only.
