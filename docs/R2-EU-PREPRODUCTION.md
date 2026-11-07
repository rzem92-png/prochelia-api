# PROCHÉLIA — R2 EU preproduction smoke test

This is an isolated Worker entrypoint. It does not import the main API, does not bind D1, does not process payments, and does not expose object listing.

## Worker and storage
- Worker: `prochelia-api-r2-preprod`
- Entrypoint: `src/r2-preprod-smoke.js`
- R2 binding: `R2_STAGING` → `prochelia-staging-storage`
- Jurisdiction: `eu`
- Public bucket development URL: keep disabled
- Payment provider: disabled
- D1: no binding in this smoke Worker

## Before deploying
1. Confirm the Dashboard shows bucket `prochelia-staging-storage`, jurisdiction EU, and public URL disabled.
2. Create a random secret at least 32 characters long; do not commit or send it in chat.
3. Set it only as a Worker secret:
   `npx wrangler secret put R2_TEST_TOKEN --config wrangler.r2-preprod.jsonc`
4. Validate the config:
   `npx wrangler deploy --dry-run --config wrangler.r2-preprod.jsonc`
5. Deploy only this isolated smoke Worker:
   `npx wrangler deploy --config wrangler.r2-preprod.jsonc`

## Smoke test after deployment
- GET `/api/health`: expect HTTP 200, `ok=true`, `status="available"`; the public response intentionally does **not** disclose R2 binding or secret configuration. Confirm binding/secret only in the authenticated Cloudflare Dashboard/configuration view.
- POST `/api/r2/smoke` with Bearer token and exact body `PROCHELIA-R2-PREPROD-TEST`.
- GET same route with Bearer token: must return `verified=true`.
- DELETE same route with Bearer token: must return `deleted=true`.
- Repeat GET: must return 404 / `OBJECT_NOT_FOUND`.
- Missing/incorrect token must return 401.
- Only one fixed synthetic non-PII object is used; no list operation exists.

Example requests (replace URL and token locally; do not paste token into GitHub):
```sh
curl -sS "$WORKER_URL/api/health"
curl -sS -X POST "$WORKER_URL/api/r2/smoke" -H "Authorization: Bearer $R2_TEST_TOKEN" --data 'PROCHELIA-R2-PREPROD-TEST'
curl -sS "$WORKER_URL/api/r2/smoke" -H "Authorization: Bearer $R2_TEST_TOKEN"
curl -sS -X DELETE "$WORKER_URL/api/r2/smoke" -H "Authorization: Bearer $R2_TEST_TOKEN"
```

## CI status
- Unit tests are credential-free and use a mock R2 adapter; they validate application behavior but are not proof of live bucket access.
- Latest workflow passed for commit `a67928b06b46989a06719ba6504fb9e70b51d05e`.

## Safety
- Do not enable public bucket access.
- Do not use real customer data.
- Do not bind production D1 or production Worker.
- Do not run migrations or production deployment from this config.
- Remove the test secret and Worker when the preproduction verification is finished, unless continued staging use is explicitly approved.

Cloudflare jurisdiction reference: https://developers.cloudflare.com/r2/reference/data-location/
