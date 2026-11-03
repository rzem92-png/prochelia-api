# PROCHÉLIA — Backup / Restore validation gates

Status: **PREPRODUCTION ONLY — NO DESTRUCTIVE ACTIONS**

## Current verified implementation

- Logical export enumerates non-SQLite tables and encrypts each exported page with AES-256-GCM.
- Uploaded objects are read back and compared against a SHA-256 digest before they are indexed.
- Backup pagination uses primary-key ordering where available and otherwise SQLite `rowid`.
- The export is **not a transactionally consistent database snapshot**. Concurrent writes can change rows between pages or between tables.
- `backup_runs` and `backup_objects` are excluded from the exported table set. This is not a full control-plane backup.
- The API currently reports a 90-day retention policy but explicitly says retention is not enforced.
- No restore implementation was found in the inspected backup code path.

## Mandatory release gates

A backup must not be described as recoverable or complete until all of the following are true:

1. **Consistent capture** — use a provider-supported consistent D1 export/snapshot or a documented write-quiescence protocol. Do not treat stable ordering as snapshot isolation.
2. **Complete inventory** — include schema, tables, indexes, triggers, views, migration/version metadata, and backup control-plane inventory. Record an explicit manifest and schema/application version.
3. **Object integrity** — verify every object checksum and authenticated decryption tag before considering a run complete. A successful PUT alone is insufficient.
4. **Restore into isolation** — restore only into a newly created, isolated non-production database. Never overwrite production as part of a test.
5. **Semantic verification** — compare schema objects, per-table row counts, critical invariants, foreign-key/integrity checks where supported, and financial ledger totals / idempotency uniqueness.
6. **Key lifecycle** — document key identifier/version, access policy, rotation and recovery escrow. Never store key material in the backup manifest, logs, D1 metadata, or repository.
7. **Retention dry-run** — inventory candidate objects, age, run status, completeness, and restore-test evidence. Retention deletion stays disabled until a human approves a reviewed manifest.
8. **Recovery evidence** — record tested RPO/RTO, restore timestamp, source run, restored database identifier, validation results, and operator approval.

## Non-destructive inventory checklist

- List all backup run records by status and age.
- List all backup object keys and compare them with actual R2 objects.
- Detect orphaned R2 objects (not indexed in D1) and missing indexed objects.
- Flag any run with status other than COMPLETED.
- Verify that each COMPLETED run has exactly the expected object inventory and matching checksums.
- Keep all findings read-only; do not delete, overwrite, or reclassify objects automatically.

## Retention policy

The declared 90-day duration is policy metadata only. Do not activate automated deletion until:
- a complete inventory has been reconciled against R2;
- a restore drill has succeeded from a selected backup;
- legal / RGPD retention requirements and holds have been reviewed;
- a signed-off dry-run deletion manifest has been approved.

## Known limitations / blockers

- The current page-based export can be inconsistent under concurrent writes.
- Backup control-plane tables are excluded.
- The inspected path contains no restore/decrypt/import implementation.
- AES-GCM key derivation currently hashes a configured string; this is not a full key-management or rotation design.
- Successful encryption and read-after-write checks do not prove a tested recovery process.

## CI expectations

Static CI should detect dangerous retention/delete operations in backup code, ensure backup retention remains dry-run only, and require explicit test evidence for consistency and restore claims. Tests must run against disposable local/test databases and must never receive production credentials.
