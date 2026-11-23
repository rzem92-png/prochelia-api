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
  "https://fix-frontend-finance-confirm.prochelia.pages.dev"
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

const serialized = JSON.stringify(preview);
if (preview.name === source.name ||
    preview.d1_databases[0].database_id !== expectedPreviewId ||
    serialized.includes(expectedProductionId) ||
    preview.r2_buckets?.length ||
    preview.triggers.crons.length !== 0 ||
    preview.observability.enabled !== true ||
    preview.observability.redact_query_string !== true ||
    preview.observability.logs.invocation_logs !== false) {
  throw new Error("Generated Preview configuration violates isolation or observability guardrails");
}

fs.writeFileSync("wrangler.preview.generated.json", JSON.stringify(preview, null, 2) + "\n");
console.log("Verified isolated Preview D1, exact CORS, redacted observability, disabled invocation logs, no R2 binding and no Cron.");
