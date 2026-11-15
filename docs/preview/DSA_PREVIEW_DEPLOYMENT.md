# DSA Preview deployment status

The DSA schema migrations 0008–0018 are applied to the non-production Preview D1 database `prochelia-preview-db` (`6adb95e5-e542-4bec-9008-fbea01042305`). The ledger is complete through migration 0018, `PRAGMA quick_check` returns `ok`, and `PRAGMA foreign_key_check` returns no rows.

A dedicated Cloudflare Workers Build configuration is now attached to the existing Preview Worker script `prochelia-api-preview` (script tag `4a03c95fb39c44fe85de494d300b2923`). It tracks this feature branch and deploys with `wrangler.preview.jsonc`, binding only the Preview D1 and Preview R2 resources. The Pages Preview service binding already targets `prochelia-api-preview`.

The separate branch Preview created by the main Worker's `npx wrangler preview` command is not used as the Pages service binding target.

Production D1, the Production Worker, Pages Production, and live payments have not been changed. The dedicated build must pass and the resulting Worker/Pages integration must be smoke-tested before this feature is considered operational.
