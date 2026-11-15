# DSA isolated Preview deployment

This branch uses a dedicated Worker target for DSA/API integration tests.

- Worker: `prochelia-api-dsa-preview`
- D1: `prochelia-preview-db` (`6adb95e5-e542-4bec-9008-fbea01042305`)
- R2: `prochelia-preview-backups-eu`
- Environment: `APP_ENV=preview`
- Pages Preview service binding is intended to target this Worker only after its build succeeds and the D1 migration ledger is verified through migration 0018.

The Preview database is non-production. Its migrations 0008–0018 were applied in order and verified with:
- `d1_migrations` containing entries 0001–0018;
- `PRAGMA quick_check` returning `ok`;
- `PRAGMA foreign_key_check` returning no rows.

Never copy this configuration to the Production Worker. Production D1 and live payments remain outside this Preview workflow.
