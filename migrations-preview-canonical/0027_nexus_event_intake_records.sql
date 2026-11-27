-- Nexus Supra event intake persistence schema. Additive append-only; no Worker dispatch enabled.
CREATE TABLE IF NOT EXISTS nexus_event_intake_records (
 record_id TEXT PRIMARY KEY NOT NULL,
 tenant_id TEXT NOT NULL CHECK(length(tenant_id) BETWEEN 1 AND 128),
 environment TEXT NOT NULL CHECK(environment IN ('preview','development','test')),
 event_id TEXT NOT NULL CHECK(length(event_id) BETWEEN 1 AND 128),
 trace_id TEXT NOT NULL CHECK(length(trace_id) BETWEEN 1 AND 128),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64 AND fingerprint NOT GLOB '*[^a-fA-F0-9]*'),
 producer TEXT NOT NULL CHECK(producer IN ('alerting','incident','correlation','root_cause','improvement','impact','case_linkage','release_readiness','operations','customer','provider','finance','security','compliance')),
 event_type TEXT NOT NULL CHECK(event_type IN ('alert.created','alert.updated','incident.opened','incident.updated','incident.resolved','incident.reopened','correlation.created','root_cause.hypothesis.created','improvement.proposed','impact.assessed','case.link.proposed','release.evidence.updated','operations.review.requested','customer.case.updated','provider.assignment.updated','finance.review.requested','security.review.requested','compliance.review.requested')),
 occurred_at TEXT NOT NULL, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_type(payload_json)='object' AND length(payload_json)<=4096),
 route_proposal_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(route_proposal_json) AND json_type(route_proposal_json)='array' AND length(route_proposal_json)<=2048),
 intake_status TEXT NOT NULL DEFAULT 'PERSISTED_PENDING_REVIEW' CHECK(intake_status IN ('PERSISTED_PENDING_REVIEW','QUARANTINE_REVIEW')),
 UNIQUE(environment,tenant_id,event_id)
);
CREATE INDEX IF NOT EXISTS idx_nexus_event_intake_tenant_recent ON nexus_event_intake_records(tenant_id,environment,received_at);
CREATE INDEX IF NOT EXISTS idx_nexus_event_intake_trace ON nexus_event_intake_records(tenant_id,environment,trace_id);
CREATE INDEX IF NOT EXISTS idx_nexus_event_intake_status ON nexus_event_intake_records(environment,intake_status,received_at);
CREATE TRIGGER IF NOT EXISTS trg_nexus_event_intake_payload_allowlist BEFORE INSERT ON nexus_event_intake_records
WHEN EXISTS(SELECT 1 FROM json_each(NEW.payload_json) WHERE key NOT IN ('status','severity','category','code','count','score','referenceId','recordType','reviewRequired','evidenceCount','estimatedExposureMinor','currency','environment','sourceStatus'))
BEGIN SELECT RAISE(ABORT,'NEXUS_EVENT_INTAKE_PAYLOAD_FIELD_NOT_ALLOWED'); END;
CREATE TRIGGER IF NOT EXISTS trg_nexus_event_intake_payload_context BEFORE INSERT ON nexus_event_intake_records
WHEN json_extract(NEW.payload_json,'$.environment') IS NOT NULL AND json_extract(NEW.payload_json,'$.environment') != NEW.environment
BEGIN SELECT RAISE(ABORT,'NEXUS_EVENT_INTAKE_PAYLOAD_CONTEXT_MISMATCH'); END;
CREATE TRIGGER IF NOT EXISTS trg_nexus_event_intake_no_update BEFORE UPDATE ON nexus_event_intake_records
BEGIN SELECT RAISE(ABORT,'NEXUS_EVENT_INTAKE_APPEND_ONLY'); END;
CREATE TRIGGER IF NOT EXISTS trg_nexus_event_intake_no_delete BEFORE DELETE ON nexus_event_intake_records
BEGIN SELECT RAISE(ABORT,'NEXUS_EVENT_INTAKE_APPEND_ONLY'); END;
