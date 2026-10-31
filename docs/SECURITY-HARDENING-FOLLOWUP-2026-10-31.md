# Security hardening follow-up — 2026-10-31

## Changes made on isolated branch

- Added route-level role preflight before consolidated schema initialization for mapped consolidated routes.
- Added route-level role preflight before operational schema initialization for mapped operational routes.
- Restricted `GET /api/prestations` to authenticated platform roles.
- Restricted `GET /api/core/schema` and `GET /api/missions/schema` to the manager role.
- Added source-level regression tests to check the order of authorization and schema initialization.

These changes are defense-in-depth. They do not remove runtime DDL and do not replace versioned migrations.

## Evidence and remaining risks

- The `prestations` table is read by legacy catalogue and mission-validation paths.
- The newer quote path reads `métier_catalog`; code search in the current branch found no insert/update statements for either catalogue in `src/index.js`.
- Code search found runtime schema helper definitions and multiple call sites for consolidated, operational, payment, strategic, commercial/recruitment and final-hardening schemas.
- The migration directory was not found at the expected path in this branch. Do not infer that no migration files exist elsewhere in the repository or in another branch.
- Runtime schema creation remains a production blocker until a complete inventory, versioned migrations, isolated migration test, backup, restore test and rollback plan exist.
- The true D1 catalogue contents and row counts must be audited read-only in the intended preview DB before any consolidation or data migration.
- CI status for the latest head commit must be checked in GitHub Actions; source-level tests are not evidence that the full application suite passes.
- No D1 write, migration, bootstrap, payment, secret change, deployment or production modification was performed.

## Required next steps

1. Inventory every schema helper and every call site, including helper-to-helper calls.
2. Inventory all catalogue references across the full repository, branches, migrations and frontend.
3. Perform read-only schema and row-count comparison on the intended preview D1, verifying the actual database binding identity.
4. Design a canonical catalogue mapping and migration plan; preserve IDs and historical quote references.
5. Convert runtime DDL to versioned migrations; deploy only to isolated preview after backup and restore test.
6. Add integration tests for unauthenticated, wrong-role, valid-role and schema-missing requests.
7. Run complete CI, Worker dry-run, browser E2E and PSP sandbox tests before considering a production release.
