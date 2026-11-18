import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HEX_64 = /^[0-9a-f]{64}$/;
const SHA_40 = /^[0-9a-f]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
  }
  return value;
}

export function canonicalManifest(manifest) {
  return JSON.stringify(normalize(manifest));
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("ATTESTATION_MANIFEST_INVALID");
  }
  if (manifest.schema_version !== 1 || manifest.attestation_type !== "prochelia.preview-d1-backup") {
    throw new Error("ATTESTATION_SCHEMA_UNSUPPORTED");
  }
  const source = manifest.source || {};
  const object = manifest.object || {};
  const provenance = manifest.provenance || {};
  const validation = manifest.validation || {};
  if (!UUID.test(source.account_id || "") || !UUID.test(source.database_id || "") ||
      !source.database_name || source.jurisdiction !== "eu") {
    throw new Error("ATTESTATION_SOURCE_INVALID");
  }
  if (object.bucket !== "prochelia-preview-backups-eu-v2" ||
      typeof object.key !== "string" ||
      !object.key.startsWith("preview-d1/" + source.database_name + "/") ||
      !object.key.endsWith(".sql.gpg") ||
      object.sha256_manifest_key !== object.key + ".sha256" ||
      !HEX_64.test(object.plaintext_sha256 || "") ||
      !HEX_64.test(object.ciphertext_sha256 || "")) {
    throw new Error("ATTESTATION_OBJECT_INVALID");
  }
  if (typeof provenance.repository !== "string" || !provenance.repository ||
      typeof provenance.workflow !== "string" || !provenance.workflow ||
      !/^\d+$/.test(String(provenance.run_id || "")) ||
      !SHA_40.test(provenance.commit_sha || "") ||
      typeof provenance.ref !== "string" || !provenance.ref) {
    throw new Error("ATTESTATION_PROVENANCE_INVALID");
  }
  if (typeof manifest.created_at !== "string" || Number.isNaN(Date.parse(manifest.created_at)) ||
      validation.sqlite_integrity_check !== "ok" ||
      validation.foreign_key_check !== "empty" ||
      validation.encryption !== "OpenPGP-AES256") {
    throw new Error("ATTESTATION_VALIDATION_INVALID");
  }
  return true;
}

function keyBuffer(key) {
  if (typeof key !== "string" || Buffer.byteLength(key, "utf8") < 32) {
    throw new Error("ATTESTATION_KEY_TOO_SHORT");
  }
  return Buffer.from(key, "utf8");
}

export function signManifest(manifest, key) {
  validateManifest(manifest);
  return createHmac("sha256", keyBuffer(key)).update(canonicalManifest(manifest), "utf8").digest("hex");
}

export function verifyManifest(manifest, signature, key) {
  try {
    if (typeof signature !== "string" || !HEX_64.test(signature)) return false;
    const expected = Buffer.from(signManifest(manifest, key), "hex");
    const supplied = Buffer.from(signature, "hex");
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}

async function main() {
  const [command, manifestPath, signaturePath] = process.argv.slice(2);
  if (!["sign", "verify"].includes(command) || !manifestPath || !signaturePath) {
    throw new Error("USAGE: node r2-backup-attestation.mjs sign|verify <manifest.json> <manifest.hmac>");
  }
  const key = process.env.BACKUP_ATTESTATION_HMAC_KEY || "";
  const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
  if (command === "sign") {
    const signature = signManifest(manifest, key);
    await writeFile(resolve(signaturePath), signature + "\n", { mode: 0o600 });
    process.stdout.write("PASS: R2 backup attestation HMAC created.\n");
    return;
  }
  const signature = (await readFile(resolve(signaturePath), "utf8")).trim();
  if (!verifyManifest(manifest, signature, key)) throw new Error("ATTESTATION_SIGNATURE_INVALID");
  process.stdout.write("PASS: R2 backup attestation HMAC verified.\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write((error?.message || "ATTESTATION_ERROR") + "\n");
    process.exitCode = 1;
  });
}
