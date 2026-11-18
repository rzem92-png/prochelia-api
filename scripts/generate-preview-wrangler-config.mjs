import fs from "node:fs";

const production = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
const expectedPreviewId = "e3cf167c-37e1-4d72-9ac6-b3e27c14b97f";
const expectedProductionId = "04f52830-ef5a-4f17-a640-42bbc2381bba";
const pagesPreviewOrigin = process.env.PAGES_PREVIEW_ORIGIN || "";
const pagesPreviewAlias = process.env.PAGES_PREVIEW_ALIAS || "";
const previewCommitSha = process.env.GITHUB_SHA || "";

if (!/^[0-9a-f]{40}$/.test(previewCommitSha)) {
  throw new Error("GITHUB_SHA must be an exact 40-character lowercase Git SHA");
}

if (production.name !== "prochelia-api") {
  throw new Error("Unexpected Production Worker config");
}
if (!production.d1_databases?.some((db) => db.binding === "DB" && db.database_id === expectedProductionId)) {
  throw new Error("Production D1 identity mismatch; refusing Preview configuration");
}
if (!/^https:\/\/[a-z0-9-]+\.prochelia\.pages\.dev$/.test(pagesPreviewOrigin)) {
  throw new Error("PAGES_PREVIEW_ORIGIN must be the exact verified HTTPS Pages Preview deployment origin");
}
if (pagesPreviewAlias && !/^https:\/\/[a-z0-9-]+\.prochelia\.pages\.dev$/.test(pagesPreviewAlias)) {
  throw new Error("PAGES_PREVIEW_ALIAS must be a verified HTTPS Pages Preview alias");
}

const allowedOrigins = [
  "https://83a36d32.prochelia.pages.dev",
  "https://c3ceec86.prochelia.pages.dev",
  "https://staging-prochelia-v14-restor.prochelia.pages.dev",
  "https://feat-supra-control-center-v1.prochelia.pages.dev",
  "https://db884f74.prochelia.pages.dev",
  "https://repair-prochelia-frontend-xs.prochelia.pages.dev",
  "https://6c01ea4a.prochelia.pages.dev",
  "https://8480de7b.prochelia.pages.dev",
  pagesPreviewOrigin,
  ...(pagesPreviewAlias ? [pagesPreviewAlias] : [])
];
const corsOrigins = [...new Set(allowedOrigins)];

const preview = {
  name: "prochelia-api-preview",
  main: "src/index.js",
  compatibility_date: "2026-09-25",
  workers_dev: true,
  vars: {
    APP_ENV: "preview",
    CORS_ORIGIN: corsOrigins.join(","),
    PROCHELIA_COMMIT_SHA: previewCommitSha
  },
  d1_databases: [{
    binding: "DB",
    database_name: "prochelia-preview-eu-2026-11-17",
    database_id: expectedPreviewId
  }],
  r2_buckets: [{
    binding: "BACKUP_BUCKET",
    bucket_name: "prochelia-preview-backups-eu-v2",
    jurisdiction: "eu"
  }],
  observability: { logs: { enabled: true, invocation_logs: true } }
};

if (preview.name === production.name ||
    preview.d1_databases.some((db) => db.database_id === expectedProductionId) ||
    preview.d1_databases[0].database_id !== expectedPreviewId ||
    preview.r2_buckets[0].jurisdiction !== "eu" ||
    !preview.vars.CORS_ORIGIN.split(",").includes(pagesPreviewOrigin) ||
    (pagesPreviewAlias && !preview.vars.CORS_ORIGIN.split(",").includes(pagesPreviewAlias))) {
  throw new Error("Preview resources are not isolated and explicitly EU-scoped");
}

fs.writeFileSync("wrangler.preview.generated.json", JSON.stringify(preview, null, 2));
console.log("Verified isolated Preview Worker, EU D1, EU R2, Pages origin/alias and API commit.");
