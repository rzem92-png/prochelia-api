-- PROCHÉLIA V14.5.7 — document security scan schema
CREATE TABLE IF NOT EXISTS document_security_scans (
 id TEXT PRIMARY KEY, document_id TEXT NOT NULL, scanner TEXT NOT NULL, result TEXT NOT NULL, signature_version TEXT,
 file_sha256 TEXT NOT NULL, threat_name TEXT, scanner_reference TEXT, scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_document_scans_latest ON document_security_scans(document_id,scanned_at DESC);
