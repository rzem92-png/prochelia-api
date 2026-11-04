# D1 Migration Safety Plan — PROCHÉLIA V14.5.7

## Current status
**No migration authorized or executed.** Preview and production schema are materially different. Treat production as the source of truth for existing data and business state.

## Hard rules
1. Never run `ensure*Schema` helpers against production as part of Worker startup, a health check, or a release audit.
2. Never copy Preview D1 over Production or run a schema dump from Preview as a replacement.
3. Never run destructive SQL (`DROP`, `TRUNCATE`, table rebuilds, destructive renames) in the initial release migration.
4. Migrations must be numbered, immutable after release, reviewed, and applied manually by a release owner.
5. Keep the current production Worker compatible with the pre-migration schema until migration verification is complete.
6. The migration and Worker deployment are separate operations; deploy only after migration compatibility is proven.

## Required preparation
- Export production schema, indexes, triggers, views, and table row counts.
- Create an encrypted, access-restricted backup; record export checksum and timestamp.
- Restore the backup into a dedicated restore database.
- Validate restored schema, row counts, foreign keys, key business invariants, and application reads.
- Create a disposable test database from that restored backup.
- Compare required columns with Worker code paths and enumerate production-only objects.
- Build migration SQL from explicit gaps—not from the Preview schema.

## Migration pattern (expand / verify / contract)
### Expand
- Add only nullable columns, new tables, and compatible indexes.
- Use explicit defaults only when semantics are understood.
- Preserve production-only tables and data.
- Avoid table rebuilds; SQLite/D1 constraint changes require a separate reviewed procedure.

### Verify
- Query `sqlite_master`, `PRAGMA table_info`, indexes and foreign-key checks.
- Verify each expected object and no unexpected object/data loss.
- Run application integration tests on the migrated clone.
- Verify old Worker and new Worker can both operate during the transition.

### Contract (later release only)
- Remove or rename legacy columns/tables only after a separate release, data backfill, monitoring period, and approval.
- Never combine contract/destructive changes with first production rollout.

## Rollback
- Prefer Worker rollback while schema remains backward compatible.
- If schema rollback would lose data, do not reverse DDL automatically; use a reviewed forward-fix.
- Restore backup only with a declared incident, explicit authorization, and verified recovery procedure.
- Record RPO/RTO and perform an actual restore drill before go-live.

## Sign-off evidence
- [ ] Backup and checksum recorded
- [ ] Restore test passed
- [ ] Migration reviewed by a second engineer
- [ ] SQL dry-run / clone migration passed
- [ ] Row counts and business invariants unchanged
- [ ] Foreign key check clean
- [ ] Integration/E2E test suite passed
- [ ] Worker compatibility and rollback demonstrated
- [ ] Release owner approved exact migration hash and target D1 ID

**Until all evidence exists: NO-GO for production D1 writes.**
