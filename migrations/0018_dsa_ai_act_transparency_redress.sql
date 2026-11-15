-- PROCHÉLIA — DSA / AI Act transparency and redress schema v1
-- Additive only. Never execute from request handlers.
-- This migration is a schema proposal for isolated validation; do not apply to Production
-- until the Production baseline has been reconciled and the release gate approved.

CREATE TABLE IF NOT EXISTS dsa_notices (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT,
  reporter_contact_hash TEXT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('LISTING','PROFILE','MESSAGE','REVIEW','AD','SERVICE')),
  subject_id TEXT NOT NULL,
  notice_type TEXT NOT NULL CHECK (notice_type IN ('ILLEGAL_CONTENT','ILLEGAL_SERVICE','FRAUD','IP_RIGHTS','SAFETY','OTHER')),
  legal_basis TEXT,
  explanation TEXT NOT NULL,
  evidence_ref TEXT,
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','UNDER_REVIEW','ACTION_TAKEN','NO_ACTION','APPEALED','CLOSED')),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TEXT,
  decision_reason TEXT,
  decision_actor_id TEXT,
  automation_used INTEGER NOT NULL DEFAULT 0 CHECK (automation_used IN (0,1)),
  outcome_notified_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_dsa_notices_status_received ON dsa_notices(status,received_at);
CREATE INDEX IF NOT EXISTS idx_dsa_notices_subject ON dsa_notices(subject_type,subject_id);

CREATE TABLE IF NOT EXISTS moderation_decisions (
  id TEXT PRIMARY KEY,
  notice_id TEXT,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  affected_user_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('NO_ACTION','LABEL','RESTRICT','DEMOTE','REMOVE','SUSPEND','TERMINATE')),
  policy_code TEXT NOT NULL,
  legal_basis TEXT,
  statement_of_reasons TEXT NOT NULL,
  duration_until TEXT,
  automation_used INTEGER NOT NULL DEFAULT 0 CHECK (automation_used IN (0,1)),
  human_reviewer_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_moderation_subject_created ON moderation_decisions(subject_type,subject_id,created_at);

CREATE TABLE IF NOT EXISTS moderation_appeals (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  appellant_user_id TEXT NOT NULL,
  grounds TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','UNDER_REVIEW','UPHELD','REVERSED','PARTIALLY_REVERSED','CLOSED')),
  reviewer_user_id TEXT,
  reviewer_independent INTEGER NOT NULL DEFAULT 0 CHECK (reviewer_independent IN (0,1)),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TEXT,
  outcome_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_status ON moderation_appeals(status,submitted_at);
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_decision ON moderation_appeals(decision_id);

CREATE TABLE IF NOT EXISTS recommender_policy_versions (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  main_parameters_json TEXT NOT NULL,
  user_controls_json TEXT NOT NULL,
  sponsored_content_policy TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  retired_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_transparency_records (
  id TEXT PRIMARY KEY,
  placement_id TEXT NOT NULL,
  advertiser_name TEXT NOT NULL,
  payer_name TEXT,
  targeting_parameters_json TEXT NOT NULL,
  is_sponsored INTEGER NOT NULL DEFAULT 1 CHECK (is_sponsored IN (0,1)),
  minor_profiling_used INTEGER NOT NULL DEFAULT 0 CHECK (minor_profiling_used IN (0,1)),
  sensitive_data_targeting_used INTEGER NOT NULL DEFAULT 0 CHECK (sensitive_data_targeting_used IN (0,1)),
  active_from TEXT NOT NULL,
  active_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (minor_profiling_used = 0),
  CHECK (sensitive_data_targeting_used = 0)
);
CREATE INDEX IF NOT EXISTS idx_ad_transparency_placement ON ad_transparency_records(placement_id,active_from);

CREATE TABLE IF NOT EXISTS trader_verification_records (
  id TEXT PRIMARY KEY,
  trader_user_id TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('PENDING','VERIFIED','NEEDS_CORRECTION','SUSPENDED','REJECTED')),
  required_fields_json TEXT NOT NULL,
  verification_sources_json TEXT NOT NULL DEFAULT '[]',
  verified_by TEXT,
  verified_at TEXT,
  next_review_at TEXT,
  listing_restricted INTEGER NOT NULL DEFAULT 1 CHECK (listing_restricted IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_trader_verification_status ON trader_verification_records(trader_user_id,verification_status);

CREATE TABLE IF NOT EXISTS child_safety_cases (
  id TEXT PRIMARY KEY,
  subject_ref TEXT NOT NULL,
  risk_category TEXT NOT NULL CHECK (risk_category IN ('UNSAFE_CONTACT','AGE_INAPPROPRIATE','EXPLOITATION','GROOMING','THREAT','OTHER')),
  age_assurance_band TEXT CHECK (age_assurance_band IN ('CHILD','TEEN','ADULT','UNKNOWN')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','TRIAGED','ESCALATED','RESOLVED','CLOSED')),
  priority TEXT NOT NULL DEFAULT 'HIGH' CHECK (priority IN ('NORMAL','HIGH','CRITICAL')),
  assigned_reviewer_id TEXT,
  evidence_ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_child_safety_status_priority ON child_safety_cases(status,priority,created_at);

CREATE TABLE IF NOT EXISTS ai_system_registry (
  id TEXT PRIMARY KEY,
  system_key TEXT NOT NULL,
  version TEXT NOT NULL,
  provider_role TEXT NOT NULL CHECK (provider_role IN ('PROVIDER','DEPLOYER','BOTH','UNDETERMINED')),
  provider_name TEXT,
  intended_purpose TEXT NOT NULL,
  modalities_json TEXT NOT NULL,
  risk_classification TEXT NOT NULL CHECK (risk_classification IN ('PROHIBITED_SCREENED','MINIMAL','TRANSPARENCY','HIGH_RISK','GPAI_COMPONENT','UNDETERMINED')),
  article50_scope_json TEXT NOT NULL DEFAULT '{}',
  human_oversight_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ASSESSMENT_REQUIRED' CHECK (status IN ('ASSESSMENT_REQUIRED','APPROVED','RESTRICTED','RETIRED')),
  assessed_at TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(system_key,version)
);
CREATE INDEX IF NOT EXISTS idx_ai_system_registry_status ON ai_system_registry(status,risk_classification);

CREATE TABLE IF NOT EXISTS ai_transparency_events (
  id TEXT PRIMARY KEY,
  system_id TEXT NOT NULL,
  system_version TEXT NOT NULL,
  interaction_ref TEXT,
  output_modality TEXT NOT NULL CHECK (output_modality IN ('TEXT','AUDIO','IMAGE','VIDEO','MULTIMODAL')),
  disclosure_type TEXT NOT NULL CHECK (disclosure_type IN ('AI_INTERACTION','SYNTHETIC_CONTENT','DEEPFAKE','PUBLIC_INTEREST_TEXT')),
  disclosure_shown INTEGER NOT NULL CHECK (disclosure_shown IN (0,1)),
  machine_marking_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK (machine_marking_status IN ('APPLIED','NOT_APPLICABLE','EXEMPTION_RECORDED','PENDING','FAILED')),
  exception_reason TEXT,
  human_reviewed INTEGER NOT NULL DEFAULT 0 CHECK (human_reviewed IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_transparency_system_created ON ai_transparency_events(system_id,created_at);

CREATE TRIGGER IF NOT EXISTS trg_ai_transparency_events_no_update
BEFORE UPDATE ON ai_transparency_events BEGIN
  SELECT RAISE(ABORT, 'AI transparency events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_ai_transparency_events_no_delete
BEFORE DELETE ON ai_transparency_events BEGIN
  SELECT RAISE(ABORT, 'AI transparency events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_moderation_decisions_no_update
BEFORE UPDATE ON moderation_decisions BEGIN
  SELECT RAISE(ABORT, 'moderation decisions are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_moderation_decisions_no_delete
BEFORE DELETE ON moderation_decisions BEGIN
  SELECT RAISE(ABORT, 'moderation decisions are append-only');
END;
