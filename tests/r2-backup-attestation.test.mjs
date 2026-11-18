import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalManifest,
  signManifest,
  validateManifest,
  verifyManifest
} from "../scripts/r2-backup-attestation.mjs";

const key = "synthetic-test-only-attestation-key-32-bytes-minimum";
const manifest = () => ({
  schema_version: 1,
  attestation_type: "prochelia.preview-d1-backup",
  created_at: "2026-11-18T10:00:00.000Z",
  source: {
    account_id: "f2a79e9fa41566a8ec80fb24c02c60eb",
    database_id: "e3cf167c-37e1-4d72-9ac6-b3e27c14b97f",
    database_name: "prochelia-preview-eu-2026-11-17",
    jurisdiction: "eu"
  },
  object: {
    bucket: "prochelia-preview-backups-eu-v2",
    key: "preview-d1/prochelia-preview-eu-2026-11-17/2026/11/18/123456789-74bd23b3d88e.sql.gpg",
    sha256_manifest_key: "preview-d1/prochelia-preview-eu-2026-11-17/2026/11/18/123456789-74bd23b3d88e.sql.gpg.sha256",
    plaintext_sha256: "a".repeat(64),
    ciphertext_sha256: "b".repeat(64)
  },
  provenance: {
    repository: "rzem92-png/prochelia-api",
    workflow: "PROCHÉLIA — sauvegarde D1 preview chiffrée vers R2 EU",
    run_id: "123456789",
    commit_sha: "74bd23b3d88e0acea62d1c58f30187ddce2011be",
    ref: "refs/heads/main",
    migration_source_sha: "1fc258c9c8d25e5e7b89241504218bf102afbf27"
  },
  validation: {
    encryption: "OpenPGP-AES256",
    sqlite_integrity_check: "ok",
    foreign_key_check: "empty"
  }
});

test("R2 backup attestation uses deterministic canonical JSON", () => {
  const a = manifest();
  const b = {
    validation: { foreign_key_check: "empty", sqlite_integrity_check: "ok", encryption: "OpenPGP-AES256" },
    provenance: { ref: a.provenance.ref, commit_sha: a.provenance.commit_sha, run_id: a.provenance.run_id, workflow: a.provenance.workflow, repository: a.provenance.repository },
    object: { ciphertext_sha256: a.object.ciphertext_sha256, plaintext_sha256: a.object.plaintext_sha256, sha256_manifest_key: a.object.sha256_manifest_key, key: a.object.key, bucket: a.object.bucket },
    source: { jurisdiction: a.source.jurisdiction, database_name: a.source.database_name, database_id: a.source.database_id, account_id: a.source.account_id },
    created_at: a.created_at,
    attestation_type: a.attestation_type,
    schema_version: a.schema_version
  };
  assert.equal(canonicalManifest(a), canonicalManifest(b));
});

test("R2 backup attestation signs and verifies the exact Preview object and provenance", () => {
  const value = manifest();
  const signature = signManifest(value, key);
  assert.match(signature, /^[0-9a-f]{64}$/);
  assert.equal(verifyManifest(value, signature, key), true);
});

test("R2 backup attestation rejects manifest tampering and the wrong key", () => {
  const value = manifest();
  const signature = signManifest(value, key);
  const tampered = structuredClone(value);
  tampered.object.ciphertext_sha256 = "c".repeat(64);
  assert.equal(verifyManifest(tampered, signature, key), false);
  assert.equal(verifyManifest(value, signature, "different synthetic key that is at least 32 bytes"), false);
});

test("R2 backup attestation refuses short keys and non-EU or malformed provenance", () => {
  const value = manifest();
  assert.throws(() => signManifest(value, "too-short"), /ATTESTATION_KEY_TOO_SHORT/);
  value.source.jurisdiction = "us";
  assert.throws(() => validateManifest(value), /ATTESTATION_SOURCE_INVALID/);
});
