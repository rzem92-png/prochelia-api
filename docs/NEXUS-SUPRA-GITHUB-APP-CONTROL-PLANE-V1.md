# NEXUS SUPRA — GitHub App control plane (V1)

Status: implementation contract / draft. This document is not evidence that a GitHub App has been created, installed, or connected.

## Objective

Give NEXUS SUPRA a dedicated, revocable, auditable identity to inspect the two PROCHÉLIA repositories, diagnose CI and code issues, create isolated branches, propose tested changes, and open draft pull requests. The integration must not depend on a founder's personal password, a personal access token, or ChatGPT's separate GitHub connector session.

Repositories allowlisted for V1:
- rzem92-png/prochelia-api
- rzem92-png/-prochelia

## Identity and credential flow

1. Create a GitHub App named `PROCHELIA-NEXUS-SUPRA` under the repository owner's GitHub account.
2. Install it only on the two allowlisted repositories.
3. Keep the App private key, App ID, installation ID(s), and webhook secret in Cloudflare Worker secrets (or a dedicated secret manager). Never put them in source, Pages assets, browser storage, D1, logs, PR comments, or prompts.
4. The Worker signs a short-lived RS256 App JWT (maximum 10 minutes), exchanges it for an installation access token, caches that token only in memory until shortly before expiry, and refreshes it as needed. Installation tokens are short-lived (normally one hour).
5. Every API call validates repository allowlisting and the required permission for the operation. No arbitrary owner/repository parameter is accepted from a client.
6. Webhook signatures are verified against the raw request body before parsing. Delivery IDs are persisted for replay protection; retries are idempotent.

## Least-privilege permissions

Required read permissions:
- Metadata: read
- Contents: read
- Pull requests: read
- Actions: read
- Checks: read
- Commit statuses: read

Required write permissions for the V1 proposal workflow:
- Contents: write (only to create a branch and commit proposed changes)
- Pull requests: write (only to open/update draft PRs)

Do not grant Administration, Secrets, Variables, Environments, Deployments, Packages, Members, Organization permissions, or Workflows write by default. Any future need to modify workflow files or repository settings requires a separate threat review, explicit owner authorization, and a new permission grant. No production deployment permission is part of V1.

Subscribe only to necessary webhook events: installation, installation_repositories, push, pull_request, workflow_run, check_suite. Reconcile installation/repository changes and immediately disable access if either repository is removed from the allowlist.

## NEXUS SUPRA service boundaries

Suggested internal modules:
- `github-app-credentials`: secret loading, key validation, rotation and readiness checks.
- `github-app-auth`: App JWT and installation-token exchange.
- `github-repository-policy`: immutable repository allowlist and operation-level permission checks.
- `github-webhooks`: raw-body signature verification, delivery replay protection and event normalization.
- `github-read`: repository metadata, files, branches, commits, PRs, workflow runs and check results.
- `github-change-proposals`: isolated feature branches, bounded file changes, commits and draft PR creation.
- `github-audit`: append-only event records with actor, tenant, repository, branch, commit SHA, PR number, operation, risk, approval reference and result.
- `github-health`: credential readiness, installation access, webhook health, rate-limit state and last successful synchronization.

The browser talks only to authenticated same-origin PROCHÉLIA routes. The browser never receives the App private key or installation token.

## Execution policy

Allowed after installation and policy validation:
- Read repository files and metadata from the allowlist.
- Inspect CI results, checks, pull requests and diffs.
- Create a uniquely named isolated branch from an explicitly reviewed base SHA.
- Commit bounded changes to that branch.
- Open a draft PR with exact changed files, rationale, risks, tests and rollback notes.
- Re-run or request non-production checks only when the workflow's permissions and trigger are safe.

Always require explicit human approval:
- Merge, branch protection changes, force pushes, deleting branches or files.
- Editing GitHub Actions workflow files, secrets, variables, environments, runners, or deployment settings.
- Any deployment, remote migration, production configuration change, payment activation, financial write, or destructive operation.
- Any action with legal, contractual, identity, payout, sanction, or personal-data consequences.

NEXUS SUPRA must never claim a test passed unless it has read the run conclusion for the exact commit SHA. A successful build is not an end-to-end, security, legal, or production-readiness approval.

## API contract (internal; exact route names subject to repository router conventions)

- `GET /api/supra/github/status`: readiness and last synchronization; never returns secrets or tokens.
- `POST /api/supra/github/sync`: enqueue allowlisted repository synchronization; idempotency key required.
- `GET /api/supra/github/repositories`: return only the two allowlisted repositories.
- `GET /api/supra/github/repositories/:repo/pull-requests`: list PRs and their exact head/base SHAs.
- `GET /api/supra/github/repositories/:repo/runs/:runId`: read workflow conclusion and job summaries.
- `POST /api/supra/github/proposals`: validate a bounded change proposal and create an isolated branch + draft PR; never merge.
- `POST /api/supra/github/webhooks`: signed webhook receiver; no browser session bypass.

All routes require authenticated SUPRA operator/service authorization, tenant scoping where applicable, CSRF/origin protections for browser-originated mutations, rate limits, request-size limits, idempotency, structured audit events, and fail-closed behavior.

## Operational controls

- Feature flag defaults OFF until the App is installed, secrets are provisioned, and a read-only health check succeeds.
- Separate Preview and Production credentials/installations. V1 must be Preview-only; no Production write path.
- Secret rotation and revocation runbook; revoke the App installation and rotate the private key immediately on suspected compromise.
- Circuit breaker on repeated authentication failures, webhook signature failures, API abuse, or anomalous write volume.
- Per-run and per-PR budget limits: maximum files, bytes, API calls, retries and execution time.
- Branch names include a unique operation ID; each proposal records base SHA and expected head SHA to prevent stale writes.
- Never log tokens, private keys, raw webhook secrets, patient/customer data, or full sensitive payloads.
- Retain audit evidence without copying unnecessary personal data.

## Acceptance criteria before enabling proposal writes

1. App installation is confirmed for exactly the two repositories.
2. Read-only authentication test passes; installation token is not exposed to the client.
3. Negative tests prove access to any third repository is denied.
4. Webhook signature, replay, duplicate delivery and malformed payload tests pass.
5. Token expiry, key rotation, revocation, API rate-limit and outage behavior are tested.
6. Cross-tenant and role-isolation tests pass.
7. Draft-only proposal test creates a branch and PR against a disposable test change; no main-branch write occurs.
8. Audit records identify exact repository, base/head SHA, actor, operation and result.
9. Security review confirms no secret leakage and no Production route.
10. Owner explicitly authorizes enabling the Preview proposal feature flag.

## Current hard boundary

This document does not create the GitHub App or install it. The repository owner must perform GitHub's account-level authorization. No credentials should be sent in chat. Until installation and secret provisioning are independently verified, SUPRA GitHub status must remain `NOT_CONNECTED` and proposal writes must remain disabled.

Production remains NO-GO.
