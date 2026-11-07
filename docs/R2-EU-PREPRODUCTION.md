# R2 EU preproduction binding

This configuration is isolated from the production Worker and production D1 database.

## Configuration guardrails
- Worker: `prochelia-api-r2-preprod` (separate from `prochelia-api`)
- D1: `prochelia-restore-test-v2` only
- R2 binding: `R2_STAGING` → `prochelia-staging-storage`, jurisdiction `eu`
- Payments: disabled (`PAYMENT_PROVIDER=disabled`)
- No production deployment, D1 migration, or production data copy is permitted from this config.

## Before deploying
1. Confirm the R2 bucket exists in the same Cloudflare account as the Worker.
2. Confirm the Dashboard shows jurisdiction EU and public development URL disabled.
3. Confirm the restore-test D1 database is disposable/non-production and its ID is still correct.
4. Validate the configuration with Wrangler:
   `npx wrangler deploy --dry-run --config wrangler.r2-preprod.jsonc`
5. Deploy only after code review and explicit preproduction approval:
   `npx wrangler deploy --config wrangler.r2-preprod.jsonc`

## Post-deploy smoke tests
- `GET /api/health` returns healthy.
- Verify the R2 binding is present from Worker runtime (no secret/credential exposure).
- Test upload, read-back, metadata, delete and verify delete; use a synthetic non-PII object only.
- Verify unauthorized requests cannot list, read, overwrite or delete objects.
- Verify the object is absent after cleanup.
- Confirm no public bucket URL was enabled.
- Do not test or deploy against production D1/Worker.

Wrangler R2 binding jurisdiction support is documented at:
https://developers.cloudflare.com/r2/reference/data-location/
