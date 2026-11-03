# PROCHÉLIA — AI security runtime gates (preproduction)

Status: **security requirements / integration gate**, not proof of implementation.

## Repository scope checked
The default branch `main` currently exposes `src/index.js`, `src/v7-routes.js`, and `src/v7.js`. No AI/SUPRA orchestration module or model-to-tool executor was found in the inspected `src/` directory. Do not claim that prompt-injection defenses are enforced in a live model runtime until the real orchestration code is connected and tested.

## Mandatory controls before enabling AI tool execution

1. **Treat all model output as untrusted.** The model may propose a structured action; it must never grant itself permissions.
2. **Server-side tool allowlist.** Resolve action names against a fixed registry. Unknown names, extra fields, malformed JSON, and schema violations fail closed.
3. **Authorization on every tool call.** Check authenticated user, tenant/client ownership, role, scope, and current resource state server-side. Never trust a role, owner ID, approval flag, or status supplied by the model/user.
4. **Least privilege and isolation.** Separate read-only tools from writes; restrict tool credentials by scope; isolate file/network/database access; deny arbitrary shell, SQL, URL fetch, and filesystem access.
5. **Human approval gates.** Require a fresh, explicit server-side approval for money movement/refunds, payment/account changes, contracts/legal actions, personal-data export/deletion, and irreversible operations. Bind approval to exact action + arguments + actor + expiry; reject replay or changed arguments.
6. **Prompt-injection defense in depth.** Delimit untrusted text; do not treat retrieved documents, email, files, web pages, or tool results as instructions; prevent secret disclosure and tool escalation. Prompt instructions alone are not a security boundary.
7. **Output and data controls.** Validate tool results; redact secrets and unnecessary personal/health/payment data; enforce tenant isolation and response schemas.
8. **Abuse controls.** Per-user/tenant rate limits, quotas, bounded tool-call count/time/size, loop detection, and safe cancellation.
9. **Audit trail.** Record actor, request/correlation ID, proposed tool, authorization decision, approval ID, result category, and timing. Never log passwords, session tokens, PSP secrets, or raw sensitive payloads.
10. **Fail-safe behavior.** On policy, authorization, model, tool, timeout, or validation errors: no side effects; return a safe error and preserve an audit event.

## Required adversarial integration tests
- Prompt injection in user text, uploaded documents, retrieved snippets, and tool output cannot change policy or reveal secrets.
- Unknown tool/action, extra arguments, forged role/owner/approval, and cross-tenant resource IDs are rejected.
- Approval is invalid if expired, reused, issued by a different actor, or bound to different arguments.
- Read-only tools cannot write; write tools cannot exceed their declared scope.
- Tool timeout, retry, duplicate request, and partial failure do not produce duplicate financial/mission effects (idempotency required).
- Secrets and sensitive fields are absent from user-visible output and logs.
- Rate/size/depth limits stop tool loops and oversized outputs.
- Model/tool outage leaves mission, payment, and user records unchanged.

## Release gate
AI actions remain **disabled or read-only** until the actual runtime passes the above tests and a reviewer verifies the tool registry, authorization middleware, approval persistence, idempotency, and audit logging. Run these tests in isolated preproduction with synthetic data; no production credentials or real payments.

## Important limitations
This checklist does not certify the system against all attacks. Prompt injection cannot be eliminated by a system prompt alone. Security acceptance requires implementation review, automated tests, deployment configuration review, and independent penetration testing.
