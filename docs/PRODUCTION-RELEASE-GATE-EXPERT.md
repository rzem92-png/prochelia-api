# PROCHÉLIA — Release gate expert (préproduction → production)

> **Statut initial : CLOSED / NOT AUTHORIZED.** Ce document est une barrière de release, pas une attestation de conformité. Aucune case ne passe à PASS sans preuve horodatée, commit SHA, environnement et responsable.

## Principes inviolables
- Preview/staging et production utilisent comptes, Worker names, D1, R2, secrets et clés PSP distincts.
- Aucun merge, migration D1 distante, déploiement production, paiement/remboursement réel ou transfert de fonds sans validation humaine explicite.
- Aucun secret/token/PII dans Git, logs, tickets ou tests.
- Les contrôles de configuration ne remplacent pas les tests runtime, revue sécurité, avis juridique ou approbation de lancement.
- Rollback documenté et testé avant trafic réel.

## Evidence ledger
| Gate | Evidence exigée | Statut initial |
|---|---|---|
| G0 Scope | SHA exact, version, environnement, responsables, change freeze | BLOCKED |
| G1 Build | Worker + Pages, assets minimisés, previews vérifiées | PARTIAL |
| G2 CI | unit/contract tests, syntax, D1 local migrations 0001–0019, API integration | PARTIAL |
| G3 Identity/session | login/logout, Secure/HttpOnly/SameSite, CSRF, CORS, expiry/revocation, rate limit | BLOCKED |
| G4 Authorization | RBAC + ownership client/provider/admin, IDOR negative tests | BLOCKED |
| G5 Mission lifecycle | create/validate/cancel/reschedule, atomic transitions, QR/check-in/out, GPS minimization | BLOCKED |
| G6 Stripe sandbox | Connect onboarding, intents, webhook signature/retries/idempotency, disputes, refunds, payouts, reconciliation | BLOCKED |
| G7 Ledger/finance | cent precision, commissions/fees/taxes/tips/surcharges/refunds/payout ownership | BLOCKED |
| G8 R2 | rotate exposed token, staging bucket/jurisdiction, PUT/GET/DELETE/hash/permissions/retention | BLOCKED |
| G9 Backup/restore | encrypted backup, checksum, isolated restore, RPO/RTO evidence | BLOCKED |
| G10 Security | SAST/dependencies/secrets, injection/XSS/SQLi, upload limits, SSRF, webhook replay, redacted logs | BLOCKED |
| G11 RGPD | register, purpose/legal basis, DPA, rights, retention/deletion, DPIA if applicable, transfers | BLOCKED |
| G12 Legal/business | platform/intermediary status, SAP/authorization if applicable, consumer rights, contracts, insurance, tax | BLOCKED |
| G13 Operations | alerts, monitoring, incident/support/dispute runbooks, backup and rollback | BLOCKED |
| G14 Human approval | written executive, technical, security, legal/finance signoff | BLOCKED |

## Acceptance tests
- User cannot read or mutate another client/provider data (401/403 tests).
- Financial operations idempotent and tied to owner, mission and PSP object.
- Unsigned, duplicate, expired or replayed webhooks rejected/handled without duplicate effects.
- Mission/payment writes fail closed if auth, RBAC, DB, PSP or transitions are invalid.
- No production data in preview; synthetic fixtures only.
- Restore is tested in isolation, never by overwriting production.
- Frontend assets expose no Git, internal source/config or secrets.
- RGPD deletion/anonymization respects legal/accounting retention requirements.

## Release / rollback runbook
1. Freeze candidate SHA and inspect dependencies/conflicts.
2. Archive CI/build/scans/sandbox/restore evidence and approvals.
3. Validate staging bindings/secrets and run acceptance tests in staging only.
4. Verify migration compatibility, rollback plan and backup before migration.
5. Obtain explicit written release approval.
6. Deploy progressively; health checks, D1 readiness, errors, latency, ledger and alerts.
7. Stop/rollback on health failure, threshold breach, ledger divergence or security/privacy incident.
8. Reconcile financial events before closing release.

## Definition of READY
READY only if all G0–G14 have PASS evidence, no unaccepted critical/high vulnerability, rollback verified and human approvals archived. Otherwise status remains CLOSED_RELEASE_VALIDATION_REQUIRED.

## Never mark complete by default
- Live R2 and full restore drill.
- Stripe sandbox E2E (Connect, webhooks, refunds, payouts, reconciliation).
- Independent security review and RGPD/legal approval.
- User acceptance tests for client/provider/admin spaces and mobile/accessibility.
- Production approval and progressive launch.
