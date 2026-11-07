# R2 preproduction live validation — operator checklist

**Scope:** isolated Worker `prochelia-api-r2-preprod` and EU bucket `prochelia-staging-storage` only. No production Worker, D1, migrations, customer data, or payment operations.

## Status at 2026-11-07 (updated after health-response hardening)
- Cloudflare Worker exists and is isolated.
- Cloudflare settings confirm `R2_STAGING` → `prochelia-staging-storage`, plus secret binding `R2_TEST_TOKEN`.
- GitHub CI unit tests passed on the latest branch commit `a67928b06b46989a06719ba6504fb9e70b51d05e` (mock R2 only). The earlier source-only commit `de312040...` failed because the code change preceded its matching test update; the subsequent test commit and workflow passed.
- Live HTTP invocation and real R2 PUT/GET/DELETE have **not yet been confirmed**. Connector-side requests to `workers.dev` were blocked by its network policy (403), which is not proof of Worker failure.
- Do not label this “R2 live-tested” until the operator checklist below succeeds.

## Security: rotate the smoke token
The test bearer token was exposed during setup. Rotate it before further testing:
1. Generate a fresh random token locally (minimum 32 characters; preferably 32+ random bytes encoded as hex).
2. Update the Worker secret in Cloudflare Dashboard → Worker → Settings → Variables and Secrets → `R2_TEST_TOKEN`. Never place it in Git, issue comments, logs, or chat.
3. Save and deploy the secret update.
4. Verify the old token returns `401 UNAUTHORIZED` and the new token succeeds.
5. Keep this token only for isolated preproduction; do not reuse it for production.

## Live validation (run locally in a terminal)
Set `WORKER_URL` and `R2_TEST_TOKEN` in your local shell. Avoid shell history if possible and never echo the token.

```sh
# Health: expect HTTP 200, ok=true, status="available". It intentionally hides binding/secret diagnostics.
curl -i "$WORKER_URL/api/health"

# Unauthorized request: expect HTTP 401
curl -i "$WORKER_URL/api/r2/smoke"

# PUT: expect HTTP 200 and operation=put
curl -i -X POST "$WORKER_URL/api/r2/smoke" \
  -H "Authorization: Bearer $R2_TEST_TOKEN" \
  -H "Content-Type: text/plain" \
  --data 'PROCHELIA-R2-PREPROD-TEST'

# GET: expect HTTP 200 and verified=true
curl -i "$WORKER_URL/api/r2/smoke" \
  -H "Authorization: Bearer $R2_TEST_TOKEN"

# DELETE: expect HTTP 200 and deleted=true
curl -i -X DELETE "$WORKER_URL/api/r2/smoke" \
  -H "Authorization: Bearer $R2_TEST_TOKEN"

# GET after delete: expect HTTP 404 and OBJECT_NOT_FOUND
curl -i "$WORKER_URL/api/r2/smoke" \
  -H "Authorization: Bearer $R2_TEST_TOKEN"
```

## Evidence to record (no token / no object contents)
- UTC timestamp and operator.
- Worker version/deployment tag.
- HTTP status for each of the six checks.
- Result of old-token rejection after rotation.
- Confirmation that the test key `preprod-smoke/health-check.txt` is absent after DELETE.
- Cloudflare Observability → Logs screenshot/export, with secrets redacted.

## Exit criteria
Mark **R2 preproduction smoke PASS** only if health, auth, put, get+verification, delete, post-delete 404, and old-token rejection all pass. This is not a backup/restore test and does not authorize production.

## Cleanup
After validation, delete the synthetic object (if present). Remove `R2_TEST_TOKEN` and delete the isolated Worker only when staging use is no longer needed. Keep the private bucket unless a separately approved retention/cleanup plan says otherwise.


## Cloudflare control-plane recheck — 2026-11-08

Read-only Cloudflare API verification:
- Worker `prochelia-api-r2-preprod` settings show binding `R2_STAGING` → `prochelia-staging-storage`, jurisdiction `eu`, and secret binding `R2_TEST_TOKEN` (secret value is not retrievable and was not exposed).
- Worker versions include version 7 (`06eeaf18-97dd-4277-af26-f701570934a7`), created 2026-11-07 22:36:20 UTC after the secret update. Deployment traffic record previously verified remains version 5 / deployment `2bcbcd16-18fd-46c4-a92e-4ab2d1864fa0` at 100%; this version/traffic distinction must not be confused.
- Cloudflare R2 bucket list API returned an empty `buckets` array, while Worker settings still report the R2 binding. This API result is **inconclusive** (possible account/API visibility issue) and requires Dashboard confirmation; do not treat it as bucket deletion or as proof bucket health.
- No live Worker HTTP smoke or actual object PUT/GET/DELETE was executed in this recheck. R2 smoke and restore remain `BLOCKED / NOT VERIFIED`.


## Preproduction Worker deployment verified — 2026-11-08

- Isolated Worker `prochelia-api-r2-preprod` deployment created and read back from Cloudflare API: deployment `e1e372c4-3623-4ac2-98b4-03867bfb6002`.
- Version `06eeaf18-97dd-4277-af26-f701570934a7` (version 7) is now assigned **100% of this isolated Worker’s traffic**. This is preproduction only; no production Worker was modified.
- This deployment applies the version created after the `R2_TEST_TOKEN` secret update. It does **not** prove R2 bucket existence/access or smoke-test success.
- R2 list API previously returned empty buckets; reconcile this with Cloudflare Dashboard before declaring bucket validated.
