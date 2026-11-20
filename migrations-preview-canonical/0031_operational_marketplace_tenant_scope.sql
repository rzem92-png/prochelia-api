-- PROCHÉLIA — tenant boundary for the operational marketplace.
-- Additive only. Existing rows deliberately remain NULL until an audited, explicit
-- attribution plan is approved. Runtime reads must always filter by authenticated tenant.
-- New writes without an active tenant are rejected at the database boundary.

ALTER TABLE clients ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE intervenants ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE prestations ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE missions ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE tarifs ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE paiements ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE disponibilites ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE evaluations ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE documents ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE conflits ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE journal ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE wallets ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_clients_tenant_user ON clients(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_intervenants_tenant_user ON intervenants(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_prestations_tenant_active ON prestations(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_missions_tenant_status_start ON missions(tenant_id, status, start_at);
CREATE INDEX IF NOT EXISTS idx_missions_tenant_intervenant ON missions(tenant_id, intervenant_id, start_at);
CREATE INDEX IF NOT EXISTS idx_tarifs_tenant_prestation_active ON tarifs(tenant_id, prestation_id, active);
CREATE INDEX IF NOT EXISTS idx_paiements_tenant_mission ON paiements(tenant_id, mission_id);
CREATE INDEX IF NOT EXISTS idx_disponibilites_tenant_intervenant_start ON disponibilites(tenant_id, intervenant_id, start_at);
CREATE INDEX IF NOT EXISTS idx_evaluations_tenant_mission ON evaluations(tenant_id, mission_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_user ON documents(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_conflits_tenant_mission ON conflits(tenant_id, mission_id);
CREATE INDEX IF NOT EXISTS idx_journal_tenant_created ON journal(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wallets_tenant_user ON wallets(tenant_id, user_id);

-- Every newly created tenant-owned record must name an active tenant.
-- Legacy NULL rows are retained for controlled attribution; they are never returned
-- by tenant-filtered application queries.
CREATE TRIGGER IF NOT EXISTS trg_clients_require_active_tenant
BEFORE INSERT ON clients WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'CLIENT_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_intervenants_require_active_tenant
BEFORE INSERT ON intervenants WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'INTERVENANT_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_prestations_require_active_tenant
BEFORE INSERT ON prestations WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'PRESTATION_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_missions_require_active_tenant
BEFORE INSERT ON missions WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'MISSION_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_tarifs_require_active_tenant
BEFORE INSERT ON tarifs WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'TARIF_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_paiements_require_active_tenant
BEFORE INSERT ON paiements WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'PAYMENT_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_disponibilites_require_active_tenant
BEFORE INSERT ON disponibilites WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'AVAILABILITY_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_evaluations_require_active_tenant
BEFORE INSERT ON evaluations WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'EVALUATION_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_documents_require_active_tenant
BEFORE INSERT ON documents WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'DOCUMENT_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_conflits_require_active_tenant
BEFORE INSERT ON conflits WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'CONFLICT_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_journal_require_active_tenant
BEFORE INSERT ON journal WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'JOURNAL_ACTIVE_TENANT_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_wallets_require_active_tenant
BEFORE INSERT ON wallets WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM tenants WHERE id=NEW.tenant_id AND status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'WALLET_ACTIVE_TENANT_REQUIRED'); END;

-- Bind user-owned rows to an active membership in the same tenant.
CREATE TRIGGER IF NOT EXISTS trg_clients_membership_scope
BEFORE INSERT ON clients WHEN NOT EXISTS (
  SELECT 1 FROM tenant_memberships m WHERE m.user_id=NEW.user_id
    AND m.tenant_id=NEW.tenant_id AND m.status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'CLIENT_TENANT_MEMBERSHIP_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_intervenants_membership_scope
BEFORE INSERT ON intervenants WHEN NOT EXISTS (
  SELECT 1 FROM tenant_memberships m WHERE m.user_id=NEW.user_id
    AND m.tenant_id=NEW.tenant_id AND m.status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'INTERVENANT_TENANT_MEMBERSHIP_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_wallets_membership_scope
BEFORE INSERT ON wallets WHEN NOT EXISTS (
  SELECT 1 FROM tenant_memberships m WHERE m.user_id=NEW.user_id
    AND m.tenant_id=NEW.tenant_id AND m.status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'WALLET_TENANT_MEMBERSHIP_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_documents_membership_scope
BEFORE INSERT ON documents WHEN NOT EXISTS (
  SELECT 1 FROM tenant_memberships m WHERE m.user_id=NEW.user_id
    AND m.tenant_id=NEW.tenant_id AND m.status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'DOCUMENT_TENANT_MEMBERSHIP_REQUIRED'); END;

CREATE TRIGGER IF NOT EXISTS trg_journal_membership_scope
BEFORE INSERT ON journal WHEN NEW.user_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM tenant_memberships m WHERE m.user_id=NEW.user_id
    AND m.tenant_id=NEW.tenant_id AND m.status='ACTIVE'
) BEGIN SELECT RAISE(ABORT, 'JOURNAL_TENANT_MEMBERSHIP_REQUIRED'); END;

-- Mission relationships must resolve inside one tenant; this prevents forged IDs
-- from linking one tenant's client to another tenant's provider or catalogue.
CREATE TRIGGER IF NOT EXISTS trg_missions_relationship_scope_insert
BEFORE INSERT ON missions WHEN
  NOT EXISTS (SELECT 1 FROM clients c WHERE c.id=NEW.client_id AND c.tenant_id=NEW.tenant_id)
  OR NOT EXISTS (SELECT 1 FROM prestations p WHERE p.id=NEW.prestation_id AND p.tenant_id=NEW.tenant_id)
  OR (NEW.intervenant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM intervenants i WHERE i.id=NEW.intervenant_id AND i.tenant_id=NEW.tenant_id
  ))
BEGIN SELECT RAISE(ABORT, 'MISSION_RELATIONSHIP_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_missions_relationship_scope_update
BEFORE UPDATE OF tenant_id, client_id, intervenant_id, prestation_id ON missions WHEN
  NEW.tenant_id IS NULL
  OR NOT EXISTS (SELECT 1 FROM clients c WHERE c.id=NEW.client_id AND c.tenant_id=NEW.tenant_id)
  OR NOT EXISTS (SELECT 1 FROM prestations p WHERE p.id=NEW.prestation_id AND p.tenant_id=NEW.tenant_id)
  OR (NEW.intervenant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM intervenants i WHERE i.id=NEW.intervenant_id AND i.tenant_id=NEW.tenant_id
  ))
BEGIN SELECT RAISE(ABORT, 'MISSION_RELATIONSHIP_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_availability_intervenant_scope
BEFORE INSERT ON disponibilites WHEN NOT EXISTS (
  SELECT 1 FROM intervenants i WHERE i.id=NEW.intervenant_id AND i.tenant_id=NEW.tenant_id
) BEGIN SELECT RAISE(ABORT, 'AVAILABILITY_INTERVENANT_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_availability_intervenant_scope_update
BEFORE UPDATE OF tenant_id, intervenant_id ON disponibilites WHEN NOT EXISTS (
  SELECT 1 FROM intervenants i WHERE i.id=NEW.intervenant_id AND i.tenant_id=NEW.tenant_id
) BEGIN SELECT RAISE(ABORT, 'AVAILABILITY_INTERVENANT_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_tarif_prestation_scope
BEFORE INSERT ON tarifs WHEN NOT EXISTS (
  SELECT 1 FROM prestations p WHERE p.id=NEW.prestation_id AND p.tenant_id=NEW.tenant_id
) BEGIN SELECT RAISE(ABORT, 'TARIF_PRESTATION_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_tarif_prestation_scope_update
BEFORE UPDATE OF tenant_id, prestation_id ON tarifs WHEN NOT EXISTS (
  SELECT 1 FROM prestations p WHERE p.id=NEW.prestation_id AND p.tenant_id=NEW.tenant_id
) BEGIN SELECT RAISE(ABORT, 'TARIF_PRESTATION_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_mission_scope
BEFORE INSERT ON paiements WHEN NOT EXISTS (
  SELECT 1 FROM missions m WHERE m.id=NEW.mission_id AND m.tenant_id=NEW.tenant_id
) BEGIN SELECT RAISE(ABORT, 'PAYMENT_MISSION_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_payment_mission_scope_update
BEFORE UPDATE OF tenant_id, mission_id ON paiements WHEN NOT EXISTS (
  SELECT 1 FROM missions m WHERE m.id=NEW.mission_id AND m.tenant_id=NEW.tenant_id
) BEGIN SELECT RAISE(ABORT, 'PAYMENT_MISSION_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_evaluation_mission_scope
BEFORE INSERT ON evaluations WHEN NOT EXISTS (
  SELECT 1 FROM missions m WHERE m.id=NEW.mission_id AND m.tenant_id=NEW.tenant_id
) BEGIN SELECT RAISE(ABORT, 'EVALUATION_MISSION_TENANT_MISMATCH'); END;

CREATE TRIGGER IF NOT EXISTS trg_conflict_mission_scope
BEFORE INSERT ON conflits WHEN NOT EXISTS (
  SELECT 1 FROM missions m WHERE m.id=NEW.mission_id AND m.tenant_id=NEW.tenant_id
) BEGIN SELECT RAISE(ABORT, 'CONFLICT_MISSION_TENANT_MISMATCH'); END;

-- Tenant identity on any row is stable after creation. Historical NULL values may
-- only be populated through the separately reviewed legacy-attribution procedure.
