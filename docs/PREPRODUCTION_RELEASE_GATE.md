# PROCHÉLIA — preproduction release gate

This gate is intentionally read-only. It does not connect to Cloudflare, execute D1 SQL,
deploy a Worker, alter a secret, merge a pull request, or touch production.

It runs the existing prelaunch regression suite and a fail-closed static audit.
The static audit blocks release while:
- request-time code still invokes schema-creation helpers;
- /api/readiness does not check the required cross-module tables;
- the ordered 0001–0005 migration set is incomplete;
- the migration set contains destructive DROP TABLE or disables foreign keys.

A red result is an expected safety block, not permission to bypass the check.
After remediation, rerun the full suite and inspect the actual workflow logs and artifacts.
Passing this static gate is necessary but not sufficient for production approval:
isolated D1 migration, restore drill, schema/data comparison, API and UI end-to-end
tests, PSP sandbox verification, security review, and explicit release approval remain required.

Production protections: no PR merge, no production migration, and no production
deployment without explicit user approval.
