# V7 validator route access-control review — Preview

## Status
Security finding identified during the API route audit. This document is a review record, not a claim that a remediation has been integrated or tested. No production changes.

## Finding
The V7 route handler currently exposes numerous POST validation/calculation routes without requiring an authenticated session at the handler boundary. Examples include account, intervenant profile, document, transport, mission, availability, conflict, pricing, QR, payment, pre-mission, idempotency, finance calculation, and strategic indicators. The permissions and audit endpoints do enforce authentication/manager role.

## Risk assessment
These endpoints appear primarily validation/calculation-only, but unauthenticated request bodies may create an oracle for business rules, expose detailed validation errors, permit resource-intensive computations, or disclose internal policy. A validation response must never be treated as authorization or proof that an action may be performed. Inputs are caller-controlled and may contain personal or mission data.

## Recommended remediation — fail closed by route class
1. Classify each route as public-safe, authenticated-user, manager-only, or internal-only, with explicit rationale.
2. Keep public endpoints only when they are stateless, low-cost, do not accept personal/mission data, and return minimal responses (e.g., syntactic email format checking—not account existence).
3. Require authenticated session for profile/document/mission/availability/conflict/pricing/QR/payment/pre-mission/idempotency and other context-bearing checks; derive actor and tenant scope from the session, never request body.
4. Manager-only: strategic indicators and operational/admin checks that reveal internal policy or data. Audit endpoints remain manager-only.
5. Add request size limits, schema validation, rate limits, generic external errors, no-store headers, and anti-enumeration behavior.
6. Treat validator output as advisory. Actual writes must independently enforce authorization, ownership, state transitions, idempotency, and atomic transaction boundaries.
7. Add route matrix regression tests: anonymous -> 401; wrong role -> 403; authorized role -> expected validation; forged actor/tenant identifiers ignored or rejected; rate-limit and oversized/malformed bodies handled.
8. Validate the route's middleware wiring in the actual Worker entrypoint, not only by direct handler unit tests.

## Acceptance criteria
- Every route has documented access class and data classification.
- No route uses caller-provided role/permissions as authority.
- Sensitive route responses are non-cacheable and minimize disclosure.
- CI tests cover every route class and representative negative cases.
- No sensitive validator is used as an action authorization gate.
- Human security review required before release.

## Jurisdiction/compliance relevance
This is a technical security/privacy control supporting GDPR data minimization, confidentiality, accountability, and consumer trust. It does not by itself establish GDPR, DGCCRF, DSA, or other legal compliance.
