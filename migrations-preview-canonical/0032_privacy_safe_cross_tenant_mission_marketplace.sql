-- PROCHÉLIA — privacy-safe cross-tenant mission marketplace.
-- The mission remains owned by the client's tenant. Public opportunities expose only
-- reviewed, non-address fields; provider applications and assignments retain both
-- owner and provider tenant identities. The legacy missions.intervenant_id is not
-- used for cross-tenant assignments.
CREATE TABLE IF NOT EXISTS mission_opportunity_consents (
  id TEXT PRIMARY KEY NOT NULL,
  owner_tenant_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  client_user_id TEXT NOT NULL,
  consent_version TEXT NOT NULL CHECK (length(trim(consent_version)) BETWEEN 3 AND 80),
  evidence_sha256 TEXT NOT NULL CHECK (length(evidence_sha256) = 64 AND lower(evidence_sha256) = evidence_sha256),
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (mission_id, owner_tenant_id),
  UNIQUE (id, owner_tenant_id),
  FOREIGN KEY (owner_tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (mission_id, owner_tenant_id) REFERENCES missions(id, tenant_id),
  FOREIGN KEY (client_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_mission_opportunity_consents_owner_status
  ON mission_opportunity_consents(owner_tenant_id, revoked_at, granted_at);

CREATE TABLE IF NOT EXISTS mission_opportunities (
  id TEXT PRIMARY KEY NOT NULL,
  owner_tenant_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  consent_id TEXT NOT NULL,
  category_code TEXT NOT NULL CHECK (length(trim(category_code)) BETWEEN 2 AND 60),
  public_summary TEXT NOT NULL CHECK (length(trim(public_summary)) BETWEEN 10 AND 600),
  city TEXT NOT NULL CHECK (length(trim(city)) BETWEEN 2 AND 100),
  postal_prefix TEXT CHECK (postal_prefix IS NULL OR length(trim(postal_prefix)) BETWEEN 2 AND 3),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  provider_pay_cents INTEGER NOT NULL CHECK (typeof(provider_pay_cents) = 'integer' AND provider_pay_cents > 0),
  currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  required_skills_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(required_skills_json) AND json_type(required_skills_json) = 'array'),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PAUSED', 'FILLED', 'CANCELLED', 'EXPIRED')),
  published_by_user_id TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (mission_id, owner_tenant_id),
  UNIQUE (id, owner_tenant_id),
  FOREIGN KEY (owner_tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (mission_id, owner_tenant_id) REFERENCES missions(id, tenant_id),
  FOREIGN KEY (consent_id, owner_tenant_id) REFERENCES mission_opportunity_consents(id, owner_tenant_id),
  FOREIGN KEY (published_by_user_id) REFERENCES users(id),
  CHECK (end_at > start_at),
  CHECK (expires_at > published_at)
);
CREATE INDEX IF NOT EXISTS idx_mission_opportunities_public_feed
  ON mission_opportunities(status, city, start_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_mission_opportunities_owner
  ON mission_opportunities(owner_tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS mission_applications (
  id TEXT PRIMARY KEY NOT NULL,
  opportunity_id TEXT NOT NULL,
  owner_tenant_id TEXT NOT NULL,
  applicant_tenant_id TEXT NOT NULL,
  intervenant_id TEXT NOT NULL,
  applicant_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'CANCELLED')),
  provider_pay_cents INTEGER NOT NULL CHECK (typeof(provider_pay_cents) = 'integer' AND provider_pay_cents > 0),
  currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 160),
  public_note TEXT CHECK (public_note IS NULL OR length(public_note) <= 500),
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TEXT,
  decided_by_user_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (opportunity_id, applicant_tenant_id, intervenant_id),
  UNIQUE (applicant_tenant_id, idempotency_key),
  UNIQUE (id, opportunity_id, owner_tenant_id, applicant_tenant_id, intervenant_id),
  FOREIGN KEY (opportunity_id, owner_tenant_id) REFERENCES mission_opportunities(id, owner_tenant_id),
  FOREIGN KEY (applicant_tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (intervenant_id, applicant_tenant_id) REFERENCES intervenants(id, tenant_id),
  FOREIGN KEY (applicant_user_id) REFERENCES users(id),
  FOREIGN KEY (decided_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_mission_applications_opportunity_status
  ON mission_applications(opportunity_id, owner_tenant_id, status, applied_at);
CREATE INDEX IF NOT EXISTS idx_mission_applications_provider
  ON mission_applications(applicant_tenant_id, intervenant_id, status, applied_at);

CREATE TABLE IF NOT EXISTS mission_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  opportunity_id TEXT NOT NULL,
  owner_tenant_id TEXT NOT NULL,
  provider_tenant_id TEXT NOT NULL,
  intervenant_id TEXT NOT NULL,
  application_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED')),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (opportunity_id, owner_tenant_id),
  FOREIGN KEY (opportunity_id, owner_tenant_id) REFERENCES mission_opportunities(id, owner_tenant_id),
  FOREIGN KEY (provider_tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (intervenant_id, provider_tenant_id) REFERENCES intervenants(id, tenant_id),
  FOREIGN KEY (application_id, opportunity_id, owner_tenant_id, provider_tenant_id, intervenant_id)
    REFERENCES mission_applications(id, opportunity_id, owner_tenant_id, applicant_tenant_id, intervenant_id)
);
CREATE INDEX IF NOT EXISTS idx_mission_assignments_provider_status
  ON mission_assignments(provider_tenant_id, intervenant_id, status, assigned_at);

-- A consent is valid only for the client who owns the mission in the same tenant.
CREATE TRIGGER IF NOT EXISTS trg_mission_opportunity_consent_owner_scope
BEFORE INSERT ON mission_opportunity_consents WHEN NOT EXISTS (
  SELECT 1
    FROM missions m
    JOIN clients c ON c.id=m.client_id AND c.tenant_id=m.tenant_id
    JOIN tenant_memberships tm ON tm.user_id=NEW.client_user_id AND tm.tenant_id=NEW.owner_tenant_id AND tm.status='ACTIVE'
   WHERE m.id=NEW.mission_id AND m.tenant_id=NEW.owner_tenant_id
     AND c.user_id=NEW.client_user_id
)
BEGIN SELECT RAISE(ABORT, 'MISSION_OPPORTUNITY_CLIENT_CONSENT_SCOPE_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_opportunity_consent_identity_immutable
BEFORE UPDATE ON mission_opportunity_consents
WHEN NEW.id<>OLD.id OR NEW.owner_tenant_id<>OLD.owner_tenant_id
  OR NEW.mission_id<>OLD.mission_id OR NEW.client_user_id<>OLD.client_user_id
  OR NEW.consent_version<>OLD.consent_version OR NEW.evidence_sha256<>OLD.evidence_sha256
  OR NEW.granted_at<>OLD.granted_at
  OR (OLD.revoked_at IS NOT NULL AND COALESCE(NEW.revoked_at,'')<>OLD.revoked_at)
BEGIN SELECT RAISE(ABORT, 'MISSION_OPPORTUNITY_CONSENT_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_opportunity_consent_revoke
AFTER UPDATE OF revoked_at ON mission_opportunity_consents
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
BEGIN
  UPDATE mission_opportunities
     SET status='CANCELLED', updated_at=CURRENT_TIMESTAMP, version=version+1
   WHERE mission_id=NEW.mission_id AND owner_tenant_id=NEW.owner_tenant_id
     AND status IN ('OPEN','PAUSED');
END;

CREATE TRIGGER IF NOT EXISTS trg_mission_opportunity_publish_guard
BEFORE INSERT ON mission_opportunities WHEN
  NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id=NEW.owner_tenant_id AND t.status='ACTIVE')
  OR NOT EXISTS (
    SELECT 1 FROM missions m
    JOIN mission_opportunity_consents c
      ON c.mission_id=m.id AND c.owner_tenant_id=m.tenant_id
    JOIN tenant_memberships tm
      ON tm.user_id=NEW.published_by_user_id AND tm.tenant_id=NEW.owner_tenant_id AND tm.status='ACTIVE'
    WHERE m.id=NEW.mission_id AND m.tenant_id=NEW.owner_tenant_id
      AND m.status='requested' AND m.intervenant_id IS NULL
      AND m.start_at=NEW.start_at AND COALESCE(m.end_at,'')=NEW.end_at
      AND CAST(ROUND(COALESCE(m.price_intervenant,0)*100) AS INTEGER)=NEW.provider_pay_cents
      AND c.id=NEW.consent_id AND c.revoked_at IS NULL
      AND c.client_user_id=(SELECT cl.user_id FROM clients cl WHERE cl.id=m.client_id AND cl.tenant_id=m.tenant_id)
  )
BEGIN SELECT RAISE(ABORT, 'MISSION_OPPORTUNITY_PUBLISH_GUARD_FAILED'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_opportunity_identity_immutable
BEFORE UPDATE ON mission_opportunities
WHEN NEW.id<>OLD.id OR NEW.owner_tenant_id<>OLD.owner_tenant_id
  OR NEW.mission_id<>OLD.mission_id OR NEW.consent_id<>OLD.consent_id
  OR NEW.provider_pay_cents<>OLD.provider_pay_cents OR NEW.currency<>OLD.currency
  OR NEW.start_at<>OLD.start_at OR NEW.end_at<>OLD.end_at
  OR NEW.published_by_user_id<>OLD.published_by_user_id OR NEW.published_at<>OLD.published_at
BEGIN SELECT RAISE(ABORT, 'MISSION_OPPORTUNITY_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_opportunity_status_transition
BEFORE UPDATE OF status ON mission_opportunities
WHEN NEW.status<>OLD.status AND NOT (
  (OLD.status='OPEN' AND NEW.status IN ('PAUSED','FILLED','CANCELLED','EXPIRED')) OR
  (OLD.status='PAUSED' AND NEW.status IN ('OPEN','CANCELLED','EXPIRED'))
)
BEGIN SELECT RAISE(ABORT, 'MISSION_OPPORTUNITY_INVALID_STATUS_TRANSITION'); END;

-- Applications are cross-tenant by design, but the applicant identity, active
-- membership, verified profile, schedule availability and pay snapshot are bound.
CREATE TRIGGER IF NOT EXISTS trg_mission_application_submit_guard
BEFORE INSERT ON mission_applications WHEN NOT EXISTS (
  SELECT 1
    FROM mission_opportunities o
    JOIN tenants t ON t.id=NEW.applicant_tenant_id AND t.status='ACTIVE'
    JOIN tenant_memberships tm
      ON tm.user_id=NEW.applicant_user_id AND tm.tenant_id=NEW.applicant_tenant_id AND tm.status='ACTIVE'
    JOIN intervenants i
      ON i.id=NEW.intervenant_id AND i.tenant_id=NEW.applicant_tenant_id
     AND i.user_id=NEW.applicant_user_id
    JOIN disponibilites d
      ON d.intervenant_id=i.id AND d.tenant_id=i.tenant_id AND d.status='available'
     AND d.start_at<=o.start_at AND d.end_at>=o.end_at
   WHERE o.id=NEW.opportunity_id AND o.owner_tenant_id=NEW.owner_tenant_id
     AND o.status='OPEN' AND o.expires_at>CURRENT_TIMESTAMP
     AND o.provider_pay_cents=NEW.provider_pay_cents AND o.currency=NEW.currency
     AND lower(i.validation_status) IN ('verified','approved','active')
)
BEGIN SELECT RAISE(ABORT, 'MISSION_APPLICATION_ELIGIBILITY_GUARD_FAILED'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_application_status_transition
BEFORE UPDATE OF status ON mission_applications
WHEN NEW.status<>OLD.status AND NOT (
  (OLD.status='SUBMITTED' AND NEW.status IN ('SHORTLISTED','ACCEPTED','REJECTED','WITHDRAWN','CANCELLED')) OR
  (OLD.status='SHORTLISTED' AND NEW.status IN ('ACCEPTED','REJECTED','WITHDRAWN','CANCELLED'))
)
BEGIN SELECT RAISE(ABORT, 'MISSION_APPLICATION_INVALID_STATUS_TRANSITION'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_application_accept_guard
BEFORE UPDATE OF status ON mission_applications
WHEN NEW.status='ACCEPTED' AND OLD.status<>'ACCEPTED' AND (
  NEW.decided_at IS NULL OR NEW.decided_by_user_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM tenant_memberships tm
    JOIN mission_opportunities o ON o.owner_tenant_id=tm.tenant_id
    WHERE o.id=NEW.opportunity_id AND tm.user_id=NEW.decided_by_user_id AND tm.status='ACTIVE'
  )
  OR NOT EXISTS (
    SELECT 1 FROM mission_opportunities o
    WHERE o.id=NEW.opportunity_id AND o.owner_tenant_id=NEW.owner_tenant_id
      AND o.status='OPEN' AND o.expires_at>CURRENT_TIMESTAMP
  )
)
BEGIN SELECT RAISE(ABORT, 'MISSION_APPLICATION_ACCEPTANCE_NOT_AUTHORIZED'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_application_identity_immutable
BEFORE UPDATE ON mission_applications
WHEN NEW.id<>OLD.id OR NEW.opportunity_id<>OLD.opportunity_id
  OR NEW.owner_tenant_id<>OLD.owner_tenant_id OR NEW.applicant_tenant_id<>OLD.applicant_tenant_id
  OR NEW.intervenant_id<>OLD.intervenant_id OR NEW.applicant_user_id<>OLD.applicant_user_id
  OR NEW.provider_pay_cents<>OLD.provider_pay_cents OR NEW.currency<>OLD.currency
  OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.applied_at<>OLD.applied_at
BEGIN SELECT RAISE(ABORT, 'MISSION_APPLICATION_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_assignment_insert_guard
BEFORE INSERT ON mission_assignments WHEN NOT EXISTS (
  SELECT 1
    FROM mission_applications a
    JOIN mission_opportunities o ON o.id=a.opportunity_id AND o.owner_tenant_id=a.owner_tenant_id
    JOIN disponibilites d ON d.intervenant_id=a.intervenant_id AND d.tenant_id=a.applicant_tenant_id
      AND d.status='available' AND d.start_at<=o.start_at AND d.end_at>=o.end_at
   WHERE a.id=NEW.application_id AND a.status='ACCEPTED'
     AND a.opportunity_id=NEW.opportunity_id AND a.owner_tenant_id=NEW.owner_tenant_id
     AND a.applicant_tenant_id=NEW.provider_tenant_id AND a.intervenant_id=NEW.intervenant_id
     AND o.status='OPEN' AND o.expires_at>CURRENT_TIMESTAMP
     AND NOT EXISTS (
       SELECT 1 FROM mission_assignments existing
       JOIN mission_opportunities eo ON eo.id=existing.opportunity_id AND eo.owner_tenant_id=existing.owner_tenant_id
       WHERE existing.provider_tenant_id=NEW.provider_tenant_id
         AND existing.intervenant_id=NEW.intervenant_id
         AND existing.status IN ('ASSIGNED','IN_PROGRESS','DISPUTED')
         AND eo.start_at<o.end_at AND eo.end_at>o.start_at
     )
)
BEGIN SELECT RAISE(ABORT, 'MISSION_ASSIGNMENT_ELIGIBILITY_OR_CONFLICT_GUARD_FAILED'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_application_accepted_create_assignment
AFTER UPDATE OF status ON mission_applications
WHEN NEW.status='ACCEPTED' AND OLD.status<>'ACCEPTED'
BEGIN
  INSERT INTO mission_assignments(
    id, opportunity_id, owner_tenant_id, provider_tenant_id, intervenant_id, application_id
  ) VALUES (
    'assignment-' || lower(hex(randomblob(16))),
    NEW.opportunity_id, NEW.owner_tenant_id, NEW.applicant_tenant_id, NEW.intervenant_id, NEW.id
  );
  UPDATE mission_opportunities
     SET status='FILLED', updated_at=CURRENT_TIMESTAMP, version=version+1
   WHERE id=NEW.opportunity_id AND owner_tenant_id=NEW.owner_tenant_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_mission_assignment_identity_immutable
BEFORE UPDATE ON mission_assignments
WHEN NEW.id<>OLD.id OR NEW.opportunity_id<>OLD.opportunity_id
  OR NEW.owner_tenant_id<>OLD.owner_tenant_id OR NEW.provider_tenant_id<>OLD.provider_tenant_id
  OR NEW.intervenant_id<>OLD.intervenant_id OR NEW.application_id<>OLD.application_id
  OR NEW.assigned_at<>OLD.assigned_at
BEGIN SELECT RAISE(ABORT, 'MISSION_ASSIGNMENT_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_assignment_status_transition
BEFORE UPDATE OF status ON mission_assignments
WHEN NEW.status<>OLD.status AND NOT (
  (OLD.status='ASSIGNED' AND NEW.status IN ('IN_PROGRESS','CANCELLED','DISPUTED')) OR
  (OLD.status='IN_PROGRESS' AND NEW.status IN ('COMPLETED','CANCELLED','DISPUTED')) OR
  (OLD.status='DISPUTED' AND NEW.status IN ('COMPLETED','CANCELLED'))
)
BEGIN SELECT RAISE(ABORT, 'MISSION_ASSIGNMENT_INVALID_STATUS_TRANSITION'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_assignment_start_timestamp
BEFORE UPDATE OF status ON mission_assignments
WHEN NEW.status='IN_PROGRESS' AND OLD.status='ASSIGNED' AND NEW.started_at IS NULL
BEGIN SELECT RAISE(ABORT, 'MISSION_ASSIGNMENT_START_TIMESTAMP_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_assignment_completion_timestamp
BEFORE UPDATE OF status ON mission_assignments
WHEN NEW.status='COMPLETED' AND NEW.completed_at IS NULL
BEGIN SELECT RAISE(ABORT, 'MISSION_ASSIGNMENT_COMPLETION_TIMESTAMP_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_mission_opportunity_consent_revocation_blocks_new_applications
BEFORE INSERT ON mission_applications WHEN EXISTS (
  SELECT 1 FROM mission_opportunities o
  JOIN mission_opportunity_consents c ON c.id=o.consent_id AND c.owner_tenant_id=o.owner_tenant_id
  WHERE o.id=NEW.opportunity_id AND c.revoked_at IS NOT NULL
)
BEGIN SELECT RAISE(ABORT, 'MISSION_OPPORTUNITY_CONSENT_REVOKED'); END;
