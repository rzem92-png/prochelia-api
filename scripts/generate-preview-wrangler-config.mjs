import fs from "node:fs";

const source = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
const expectedPreviewId = "e3cf167c-37e1-4d72-9ac6-b3e27c14b97f";
const expectedProductionId = "04f52830-ef5a-4f17-a640-42bbc2381bba";
const expectedPreviewName = "prochelia-preview-eu-2026-11-17";
const expectedWorkerName = "fix-pages-proxy-preview-cors-2026-11-23";

if (source.name !== "prochelia-api") {
  throw new Error("Unexpected source Worker config");
}
if (!source.d1_databases?.some((db) => db.binding === "DB" && db.database_id === expectedProductionId)) {
  throw new Error("Production D1 identity mismatch; refusing Preview configuration");
}

const sourcePreviewDb = source.previews?.d1_databases?.find((db) => db.binding === "DB");
if (sourcePreviewDb?.database_id !== expectedPreviewId ||
    sourcePreviewDb?.database_name !== expectedPreviewName) {
  throw new Error("Dedicated Preview D1 identity mismatch; refusing deployment");
}

const origins = String(source.previews?.vars?.CORS_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const requiredOrigins = [
  "https://pages-proxy-2026-11-23.prochelia.pages.dev",
  "https://fix-frontend-finance-confirm.prochelia.pages.dev",
  "https://fix-frontend-accounting-read.prochelia.pages.dev"
];
if (origins.includes("*") || origins.some((origin) => !origin.startsWith("https://")) ||
    requiredOrigins.some((origin) => !origins.includes(origin))) {
  throw new Error("Preview CORS allowlist is not exact and HTTPS-only");
}

const previewVars = {
  APP_ENV: "preview",
  CORS_ORIGIN: origins.join(",")
};
const previewD1 = {
  binding: "DB",
  database_name: expectedPreviewName,
  database_id: expectedPreviewId
};

const enablePreviewR2 = process.env.PROCHELIA_PREVIEW_R2_VERIFIED_BY_WORKFLOW === "true";
const retentionVerified = process.env.PROCHELIA_PREVIEW_R2_RETENTION_VERIFIED_BY_WORKFLOW === "true";
if (enablePreviewR2) {
  const approvedWorkflowContext =
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch" &&
    process.env.GITHUB_REPOSITORY === "rzem92-png/prochelia-api" &&
    process.env.GITHUB_REF === "refs/heads/fix/pages-proxy-preview-cors-2026-11-23" &&
    process.env.GITHUB_ACTOR === "rzem92-png" &&
    process.env.PROCHELIA_PREVIEW_DEPLOY_CONFIRMATION === "DEPLOY_PREVIEW_ONLY" &&
    retentionVerified;
  if (!approvedWorkflowContext) {
    throw new Error("R2 binding requires the owner-confirmed manual Preview workflow after EU bucket and retention verification");
  }
}

const preview = {
  name: expectedWorkerName,
  main: source.main || "src/index.js",
  compatibility_date: source.compatibility_date || "2026-09-25",
  compatibility_flags: source.compatibility_flags || [],
  workers_dev: true,
  vars: previewVars,
  d1_databases: [previewD1],
  previews: {
    vars: previewVars,
    d1_databases: [previewD1]
  },
  // No R2 binding until the EU bucket is independently inventoried and attested.
  // No Cron until queue scope and job execution receive a separate review.
  triggers: { crons: [] },
  observability: {
    enabled: true,
    redact_query_string: true,
    head_sampling_rate: 1,
    logs: {
      enabled: true,
      invocation_logs: false,
      head_sampling_rate: 1,
      persist: true
    },
    traces: {
      enabled: false,
      persist: false
    }
  }
};

if (enablePreviewR2) {
  preview.r2_buckets = [{
    binding: "BACKUP_BUCKET",
    bucket_name: "prochelia-preview-backups-eu-v2",
    jurisdiction: "eu"
  }];
}

const serialized = JSON.stringify(preview);
if (preview.name === source.name ||
    preview.d1_databases[0].database_id !== expectedPreviewId ||
    serialized.includes(expectedProductionId) ||
    (enablePreviewR2 && !preview.r2_buckets?.some((bucket) =>
      bucket.binding === "BACKUP_BUCKET" &&
      bucket.bucket_name === "prochelia-preview-backups-eu-v2" &&
      bucket.jurisdiction === "eu"
    )) ||
    (!enablePreviewR2 && preview.r2_buckets?.length) ||
    preview.triggers.crons.length !== 0 ||
    preview.observability.enabled !== true ||
    preview.observability.redact_query_string !== true ||
    preview.observability.logs.invocation_logs !== false) {
  throw new Error("Generated Preview configuration violates isolation or observability guardrails");
}

fs.writeFileSync("wrangler.preview.generated.json", JSON.stringify(preview, null, 2) + "\n");
console.log(enablePreviewR2
  ? "Verified owner-confirmed manual Preview context, exact EU R2 binding, isolated D1, redacted observability and no Cron."
  : "Verified isolated Preview D1, exact CORS, redacted observability, disabled invocation logs, no R2 binding and no Cron.");
