# PROCHÉLIA — R2 Preview backup and restore release gate

## Verified Cloudflare state (2026-11-22)

The Preview Worker `prochelia-api-preview` currently has:

- `APP_ENV=preview`
- `DB` bound to the EU-jurisdiction Preview D1 database `prochelia-preview-eu-2026-11-17`
- `BACKUP_BUCKET` bound to `prochelia-preview-backups-eu-v2` with jurisdiction `eu`

The referenced R2 bucket `prochelia-preview-backups-eu-v2` is not present in the account's R2 bucket list. The Worker binding therefore points to a missing resource.

The existing bucket `prochelia-preview-backups-eu-locked` is not a safe substitute: its observed jurisdiction is `default`, its lock-rule list is empty, and its object list is empty. A European location hint such as `WEUR` is not equivalent to the R2 `eu` jurisdiction.

## Required remediation

1. Provision the intended bucket `prochelia-preview-backups-eu-v2` with the explicit R2 jurisdiction `eu`.
2. Read back the bucket metadata and verify `jurisdiction=eu`.
3. Confirm the Preview Worker's `BACKUP_BUCKET` binding resolves to that exact bucket and jurisdiction.
4. Configure and read back an appropriate object-lock/retention policy only after its retention period and legal requirements have been approved.
5. Run a Preview-only backup: export only the Preview D1 database, encrypt before upload, and store integrity metadata separately from the encrypted payload.
6. Download the object, verify the cryptographic checksum and decryption, restore into a fresh isolated SQLite database, and require `PRAGMA integrity_check` to return exactly `ok`.
7. Record the backup object key, timestamp, database identity, schema/migration version, checksum, encryption key version identifier (never the key), and restore result.
8. Perform a second restore rehearsal and document recovery time and recovery point.

## Safety constraints

- Do not redirect the Preview binding to a bucket with `jurisdiction=default`.
- Do not use or write to the Production D1 database or Production backup bucket for this Preview test.
- Do not claim immutability while the bucket has no effective lock rules.
- Do not treat a successful checksum/decryption step as proof of a successful database restore.
- This workflow is manually gated and Preview-only. No Production migration, deployment, payment activation, or payout activation is authorized by this document.

## Current status

**BLOCKED:** the Worker binding references a missing EU-jurisdiction bucket. The isolated SQLite restore assertion is present in the guarded workflow and is covered by CI contract checks, but an actual R2 download-and-restore rehearsal has not yet been demonstrated.
