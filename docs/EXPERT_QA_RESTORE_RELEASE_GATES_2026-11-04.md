# PROCHÉLIA — Expert QA & Recovery Gates (2026-11-04)

Status: **documentary/preproduction gate**. This document does not certify production readiness. No production D1, Cloudflare settings, secrets, payment provider, or deployment were changed.

## Safety envelope
- Target only a disposable, isolated preproduction D1 database and non-production credentials.
- Never restore over production or a shared preproduction database.
- Obtain explicit owner approval before any D1 migration, production deployment, DNS change, or live PSP action.
- Keep the source encrypted backup immutable; record SHA-256, byte length, timestamp, workflow/run ID, source environment and retention expiry. Never log encryption keys or credentials.
- Restore into a newly created isolated database, not an existing target.
- Use least-privilege temporary credentials and revoke them after the test.

## Gate R1 — Restore drill (required before production)
1. Select a successful encrypted preproduction backup artifact. Verify artifact provenance and workflow commit.
2. Verify archive checksum/signature and encryption metadata before decrypting. Reject tampered, truncated, wrong-key, or unknown-format artifacts.
3. Decrypt in an ephemeral runner with secrets masked; do not print plaintext SQL/data or keys to logs.
4. Restore to a newly created isolated D1 database using the documented restore procedure. No production identifiers should be present in the workflow variables.
5. Run schema checks: expected tables/indexes/constraints, migration ledger, schema version, and absence of unexpected tables.
6. Run data-integrity checks: row counts per table (counts only), FK/orphan checks where applicable, duplicate business keys, mission/payment/case referential consistency, and redacted sampling.
7. Execute read-only application smoke tests against the restored target: health, auth/session, client/provider ownership boundaries, mission reads, support case reads, payment status reads. No real PSP actions.
8. Compare expected checksums/counts to backup manifest. Record discrepancies and stop on mismatch.
9. Destroy the disposable database and ephemeral credentials; retain only sanitized report and audit evidence.
10. Record operator, approver, timestamps, backup ID/hash, target isolation proof, restore duration, verification outcomes, cleanup result, and incident ticket if any.

**Pass criteria:** restore reproducible from encrypted artifact; integrity checks complete; no secrets/plaintext exposed; target isolation proven; cleanup verified; report reviewed by a second person.
**Fail criteria:** any unexplained schema/data mismatch, artifact integrity failure, missing audit trail, secret leakage, target ambiguity, or incomplete cleanup. A failed restore must block production readiness.

## Gate S1 — Authorization / tenant isolation
Test with two clients, two providers, a manager and an unauthenticated actor:
- Direct object reference (IDOR) across client, provider, mission, document, case, invoice and payment IDs.
- Role/permission escalation by altering request body, query, headers, or client-side claims.
- Cross-tenant list/detail/search/export, attachments and audit event access.
- Forged document `verifie`, payment status, mission state, admin role, permissions and strategic metrics.
- Ownership change between authorization and write (TOCTOU).
**Expected:** deny by default; role/session and ownership derived server-side; consistent 401/403/404 policy; no unauthorized side effects; tests assert database state remains unchanged.

## Gate S2 — Mission lifecycle and concurrency
- Two simultaneous acceptances for one mission; accept vs cancel; provider/client reschedule collision; QR check-in/out replay; duplicate retries; stale version/CAS.
- Boundary tests for duration, mileage, date/time zones, DST, weekend/night pricing and invalid transitions.
**Expected:** one winning transition; atomic state + audit/outbox writes; stable idempotency key; conflict response for stale version; no double booking/payment/invoice.

## Gate S3 — PSP/payment/refund
Use PSP sandbox only:
- Webhook valid/invalid HMAC, altered body, wrong key, replay, duplicate event, delayed/out-of-order event, concurrent delivery, timeout and retry.
- Checkout idempotency under concurrent requests; client cannot set authoritative price, paid/refunded status, commission or provider payout.
- Refund queue vs actual PSP confirmation: queued/review is not “refunded”; reconcile provider event and internal ledger.
**Expected:** durable event ID uniqueness, verified timestamp/signature per PSP contract, idempotent ledger, atomic/outbox reconciliation, no live money movement.

## Gate S4 — SUPRA / Nexus controls
- Treat customer/provider text, uploaded files, webpages and tool outputs as untrusted data, never system instructions.
- Test prompt injection, exfiltration attempts, tool-call privilege escalation, cross-tenant retrieval, malformed tool output, loops and budget exhaustion.
- SUPRA cannot bypass human approval for financial, legal, contractual, identity, refund, dispute closure or production changes.
- Nexus matching must exclude sensitive attributes and proxies; expose explainable factors, user appeal/override, fairness metrics and audit.
**Expected:** least-privilege tools, scoped context, redacted logs, bounded retries/cost, human approval gates enforced server-side.

## Gate S5 — Uploads, privacy, retention
- MIME/content mismatch, oversized files, archive bombs, malicious documents, malware scanner timeout/error and quarantine bypass.
- Verify fail-closed upload flow, private object storage, signed URL expiry, access revocation and audit.
- Exercise access/export/correction/deletion/anonymization workflows, legal retention exceptions, backup expiry and deletion propagation.
**Expected:** no public object exposure; scanner outage blocks release; minimization and retention rules documented; deletion results traceable without retaining unnecessary personal data.

## Gate S6 — Reliability / operations
- Rate limiting, brute-force lockout, session expiry/revocation, CSRF, CORS, cookie flags, error redaction.
- D1/PSP/object storage timeout, partial failure, queue retry, dead-letter, outbox replay and alert delivery.
- Verify backups, restore drills, RPO/RTO, incident response, rollback and security contact.
**Expected:** bounded retries, no duplicate side effects, clear alerts, tested rollback and operational owner.

## Evidence and release decision
For each gate attach: commit SHA, environment, test command/workflow, timestamp, sanitized logs, pass/fail, defects, reviewer and retest SHA. Do not mark a gate passed based on documentation alone.

Production decision remains **NO-GO** until:
- restore drill passes in isolated preproduction;
- authorization/IDOR and concurrency tests pass;
- PSP sandbox contract/replay/idempotency tests pass;
- security/privacy review and mobile E2E complete;
- migration plan reviewed, backup/rollback verified;
- human owner explicitly approves release.

## Known outstanding risks to close
- Body-trusted V7 permission/document/payment/audit/metrics validation must never become authoritative.
- Client-supplied pricing parameters must be replaced by server-owned tariff calculation at checkout.
- SUPRA automatic execution must not bypass human approval for sensitive operations.
- Support case/mission/payment writes require ownership validation, atomicity or durable outbox, CAS/versioning and idempotency.
- DDL/schema initialization must not run from unauthenticated HTTP request paths.
- Webhook replay, timestamp/nonce (according to PSP specification), duplicate and out-of-order delivery need proof.
- Restore has not been certified merely because backup workflow succeeded.
