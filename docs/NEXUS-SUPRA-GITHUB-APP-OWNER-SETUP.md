# PROCHÉLIA — Owner setup for the NEXUS SUPRA GitHub App

Status: owner action required. This runbook does not mean the App is installed or connected.

## Scope

Install the dedicated `PROCHELIA-NEXUS-SUPRA` GitHub App on exactly:
- `rzem92-png/prochelia-api`
- `rzem92-png/-prochelia`

Do not install it on the whole account or organization.

## Create the App

In GitHub, open Settings → Developer settings → GitHub Apps → New GitHub App.

Use:
- Name: `PROCHELIA-NEXUS-SUPRA`
- Homepage URL: the official PROCHÉLIA site when available; otherwise the repository URL.
- Webhook: enable only when the backend receiver is deployed and ready; generate a unique webhook secret.
- Where can this GitHub App be installed? Only the owner account that owns the two repositories.

Set repository permissions to the least privilege:
- Metadata: Read-only (required)
- Contents: Read-only initially
- Pull requests: Read-only initially
- Actions: Read-only
- Checks: Read-only
- Commit statuses: Read-only

Do not enable write permissions during initial installation. Do not grant Administration, Secrets, Variables, Environments, Deployments, Workflows, Members, or organization permissions.

Subscribe only to the events needed by the implemented receiver. Do not enable webhook delivery until signature verification and replay protection are deployed.

## Install and verify

1. Create the App and save its App ID in the owner's secure password manager.
2. Generate the private key and download it once. Never paste it into ChatGPT, a GitHub issue, a commit, D1, or a browser field.
3. Install the App on the two named repositories only.
4. Record the installation ID securely.
5. Verify the installation repository list contains exactly those two repositories.
6. Keep proposal/write capabilities disabled. The first backend integration milestone is read-only authentication and repository allowlist enforcement.
7. Add credentials only as Cloudflare Worker secrets after the backend has a reviewed secret-loading implementation. Use separate Preview and Production secret scopes; V1 must be Preview-only.
8. Run negative tests proving a third repository is denied and the private key/token never appears in API responses, logs, or browser assets.

## Enable proposal writes later

Only after read-only tests, webhook signature/replay tests, audit logging, rate limits, tenant isolation, and security review pass:
- Request the minimum Contents: Write and Pull requests: Write permissions.
- Keep workflow, secrets, settings, deployments, and administration permissions disabled.
- Allow SUPRA to create isolated feature branches and draft PRs only.
- Require a human to approve merges, workflow edits, migrations, payment changes, production configuration, and deployments.

## Rotation and emergency revocation

If the private key is suspected compromised:
1. Suspend the integration feature flag.
2. Revoke/delete the affected App private key.
3. Revoke the installation or uninstall the App if required.
4. Rotate the webhook secret.
5. Review audit events and GitHub App activity.
6. Re-enable only after new credentials and negative tests are verified.

## Completion evidence

The owner should be able to show:
- App installation page listing exactly the two allowed repositories.
- Successful read-only status check showing App identity and repository access, without exposing tokens.
- A denied access test for an unrelated repository.
- A successful draft-PR proposal test on a disposable branch, after write permission is separately approved.

Until that evidence exists, NEXUS SUPRA must report `NOT_CONNECTED`. This runbook does not authorize production changes. Production remains NO-GO.
