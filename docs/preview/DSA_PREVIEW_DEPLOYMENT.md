# DSA Preview deployment status

The DSA schema migrations 0008–0018 are applied to the non-production Preview D1 database `prochelia-preview-db` (`6adb95e5-e542-4bec-9008-fbea01042305`). The ledger is complete through migration 0018, `PRAGMA quick_check` returns `ok`, and `PRAGMA foreign_key_check` returns no rows.

The backend branch is built as an isolated Cloudflare Worker Preview using `npx wrangler preview`. Its Preview URL is separate from the Pages service binding. The Pages Preview project currently binds `PROCHELIA_API` to the shared `prochelia-api-preview` Worker, not to this isolated branch build.

Cloudflare Workers Builds enforces the connected Worker name `prochelia-api`; a branch-specific `wrangler deploy` to a different Worker name is rejected. Do not bypass that guard or target the Production Worker. End-to-end Pages-to-DSA-API integration remains a Preview release gate until the binding can be changed through a supported, isolated deployment workflow.

Production D1, the Production Worker, Pages Production, and live payments have not been changed.
