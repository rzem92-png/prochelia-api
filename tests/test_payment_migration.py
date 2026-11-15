import pathlib
import re
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0005_payment_runtime_schema.sql"
HARDENING_MIGRATION = ROOT / "migrations" / "0009_final_hardening_schema.sql"


class PaymentMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")

    def tearDown(self):
        self.db.close()

    def test_migration_runs_and_is_idempotent(self):
        sql = MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        tables = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        expected = {
            "payment_accounts", "wallets", "payment_transactions",
            "payout_requests", "payment_webhook_events", "payment_disputes",
            "payment_reconciliation", "payment_audit", "payment_wallet_ledger",
        }
        self.assertTrue(expected.issubset(tables))

    def test_migration_has_no_destructive_sql(self):
        sql = re.sub(r"--[^\n]*", "", MIGRATION.read_text(encoding="utf-8")).upper()
        for forbidden in (r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b",
                          r"\bDELETE\s+FROM\b", r"^\s*UPDATE\s+"):
            self.assertIsNone(re.search(forbidden, sql, flags=re.MULTILINE))

    def test_unique_idempotency_constraints(self):
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO payment_transactions(id,idempotency_key,type,status) VALUES('t1','same','CHARGE','PENDING')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO payment_transactions(id,idempotency_key,type,status) VALUES('t2','same','CHARGE','PENDING')")
        self.db.execute("INSERT INTO payment_webhook_events(id,provider,event_id,event_type) VALUES('w1','provider','evt1','payment')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO payment_webhook_events(id,provider,event_id,event_type) VALUES('w2','provider','evt1','payment')")

    def test_hardening_migration_runs_and_is_idempotent(self):
        sql = HARDENING_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        objects = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','index')"
        )}
        expected = {
            "system_config_checks", "idx_system_config_checks_code",
            "idempotency_records", "background_jobs", "idx_background_jobs_ready",
            "security_rate_limits", "integration_registry",
            "production_security_events", "idx_prod_sec_events_date",
        }
        self.assertTrue(expected.issubset(objects))

    def test_hardening_migration_has_no_destructive_sql(self):
        sql = re.sub(r"--[^\n]*", "", HARDENING_MIGRATION.read_text(encoding="utf-8")).upper()
        for forbidden in (r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b",
                          r"\bDELETE\s+FROM\b", r"^\s*UPDATE\s+"):
            self.assertIsNone(re.search(forbidden, sql, flags=re.MULTILINE))


IDENTITY_SECURITY_MIGRATION = ROOT / "migrations" / "0010_identity_mission_security_schema.sql"


class IdentityMissionSecurityMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")

    def tearDown(self):
        self.db.close()

    def test_migration_runs_idempotently_and_creates_all_required_objects(self):
        sql = IDENTITY_SECURITY_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        objects = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','index')"
        )}
        expected = {
            "identity_verifications", "idx_identity_verifications_user",
            "trusted_devices", "mission_security",
            "idx_mission_security_intervenant", "mission_security_attempts",
            "idx_security_attempts_security", "security_audit",
            "idx_security_audit_mission",
        }
        self.assertTrue(expected.issubset(objects))

    def test_migration_preserves_unique_device_and_mission_invariants(self):
        self.db.executescript(IDENTITY_SECURITY_MIGRATION.read_text(encoding="utf-8"))
        self.db.execute(
            "INSERT INTO trusted_devices(id,user_id,device_hash,expires_at) VALUES('d1','u1','h1','2030-01-01')"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO trusted_devices(id,user_id,device_hash,expires_at) VALUES('d2','u1','h1','2030-01-01')"
            )
        self.db.execute(
            "INSERT INTO mission_security(id,mission_id,client_id,intervenant_id) VALUES('s1','m1','c1','i1')"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO mission_security(id,mission_id,client_id,intervenant_id) VALUES('s2','m1','c2','i2')"
            )

    def test_migration_has_no_destructive_sql(self):
        sql = re.sub(
            r"--[^\n]*", "",
            IDENTITY_SECURITY_MIGRATION.read_text(encoding="utf-8")
        ).upper()
        for forbidden in (
            r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b",
            r"\bDELETE\s+FROM\b", r"^\s*UPDATE\s+"
        ):
            self.assertIsNone(re.search(forbidden, sql, flags=re.MULTILINE))


if __name__ == "__main__":
    unittest.main()


STRATEGIC_COMMERCIAL_MIGRATION = ROOT / "migrations" / "0011_strategic_commercial_schema.sql"


class StrategicCommercialMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")

    def tearDown(self):
        self.db.close()

    def test_migration_runs_idempotently_and_creates_all_objects(self):
        sql = STRATEGIC_COMMERCIAL_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        objects = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','index')"
        )}
        expected = {
            "promotions", "idx_promotions_active",
            "promotion_recommendations", "idx_promotion_reco_status",
            "commercial_events", "idx_commercial_events",
            "market_signals", "idx_market_signals",
            "client_value_scores", "strategic_alerts",
        }
        self.assertTrue(expected.issubset(objects))

    def test_migration_preserves_unique_promotion_code_and_client_score(self):
        self.db.executescript(STRATEGIC_COMMERCIAL_MIGRATION.read_text(encoding="utf-8"))
        self.db.execute(
            "INSERT INTO promotions(id,code,name,type,phase,starts_at,ends_at) VALUES(?,?,?,?,?,?,?)",
            ("p1", "PROMO", "Promo", "PERCENT", "TEST", "2030-01-01", "2030-02-01"),
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO promotions(id,code,name,type,phase,starts_at,ends_at) VALUES(?,?,?,?,?,?,?)",
                ("p2", "PROMO", "Promo 2", "PERCENT", "TEST", "2030-01-01", "2030-02-01"),
            )
        self.db.execute(
            "INSERT INTO client_value_scores(id,client_id,company_id,segment) VALUES('v1','c1','co1','STANDARD')"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO client_value_scores(id,client_id,company_id,segment) VALUES('v2','c1','co1','STANDARD')"
            )

    def test_migration_has_no_destructive_sql(self):
        sql = re.sub(
            r"--[^\n]*", "",
            STRATEGIC_COMMERCIAL_MIGRATION.read_text(encoding="utf-8")
        ).upper()
        for forbidden in (
            r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b",
            r"\bDELETE\s+FROM\b", r"^\s*UPDATE\s+"
        ):
            self.assertIsNone(re.search(forbidden, sql, flags=re.MULTILINE))


CONSOLIDATED_BUSINESS_MIGRATION = ROOT / "migrations" / "0012_consolidated_business_schema.sql"


class ConsolidatedBusinessMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")

    def tearDown(self):
        self.db.close()

    def test_migration_runs_idempotently_and_seeds_defaults_once(self):
        sql = CONSOLIDATED_BUSINESS_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.execute(
            "UPDATE platform_settings SET value_json=? WHERE key=?",
            ('"CUSTOM"', "project_phase"),
        )
        self.db.executescript(sql)
        objects = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','index')"
        )}
        expected = {
            "platform_settings", "business_profiles", "métier_catalog",
            "metier_suggestions", "pricing_policies", "pricing_quotes",
            "operational_cases", "idx_cases_status", "case_actions", "copilot_log",
            "activity_journal", "commercial_tasks", "recruitment_tasks", "complaints",
            "accounting_ledger", "idx_ledger_ref", "business_expenses",
            "notification_outbox", "compliance_events",
        }
        self.assertTrue(expected.issubset(objects))
        self.assertEqual(
            self.db.execute("SELECT value_json FROM platform_settings WHERE key='project_phase'").fetchone()[0],
            '"CUSTOM"',
        )
        self.assertEqual(
            self.db.execute("SELECT COUNT(*) FROM platform_settings").fetchone()[0],
            7,
        )

    def test_migration_has_no_destructive_sql(self):
        sql = re.sub(
            r"--[^\n]*", "",
            CONSOLIDATED_BUSINESS_MIGRATION.read_text(encoding="utf-8")
        ).upper()
        for forbidden in (
            r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b",
            r"\bDELETE\s+FROM\b", r"^\s*UPDATE\s+"
        ):
            self.assertIsNone(re.search(forbidden, sql, flags=re.MULTILINE))


CONSOLIDATED_BUSINESS_MIGRATION = ROOT / "migrations" / "0012_consolidated_business_schema.sql"


class ConsolidatedBusinessMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")

    def tearDown(self):
        self.db.close()

    def test_migration_runs_idempotently_and_creates_all_required_objects(self):
        # Pricing tables are provisioned by migration 0002, not duplicated here.
        self.db.executescript(
            (ROOT / "migrations" / "0002_server_pricing.sql").read_text(encoding="utf-8")
        )
        sql = CONSOLIDATED_BUSINESS_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        objects = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','index')"
        )}
        expected = {
            "platform_settings", "business_profiles", "métier_catalog",
            "metier_suggestions", "pricing_policies", "pricing_quotes",
            "operational_cases", "idx_cases_status", "case_actions",
            "copilot_log", "activity_journal", "commercial_tasks",
            "recruitment_tasks", "complaints", "accounting_ledger",
            "idx_ledger_ref", "business_expenses", "notification_outbox",
            "compliance_events",
        }
        self.assertTrue(expected.issubset(objects))

    def test_seeded_settings_are_insert_only_and_idempotent(self):
        self.db.executescript(CONSOLIDATED_BUSINESS_MIGRATION.read_text(encoding="utf-8"))
        self.db.execute(
            "UPDATE platform_settings SET value_json='\\"CUSTOM\\"' WHERE key='project_phase'"
        )
        self.db.executescript(CONSOLIDATED_BUSINESS_MIGRATION.read_text(encoding="utf-8"))
        value = self.db.execute(
            "SELECT value_json FROM platform_settings WHERE key='project_phase'"
        ).fetchone()[0]
        self.assertEqual(value, '"CUSTOM"')

    def test_migration_does_not_duplicate_pricing_ownership_or_use_destructive_sql(self):
        sql = re.sub(
            r"--[^\n]*", "",
            CONSOLIDATED_BUSINESS_MIGRATION.read_text(encoding="utf-8")
        ).upper()
        self.assertNotRegex(sql, r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+PRICING_(POLICIES|QUOTES)")
        for forbidden in (
            r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b",
            r"\bDELETE\s+FROM\b", r"^\s*UPDATE\s+"
        ):
            self.assertIsNone(re.search(forbidden, sql, flags=re.MULTILINE))


FINANCE_WORKSPACE_MIGRATION = ROOT / "migrations" / "0013_finance_workspace_schema.sql"


class FinanceWorkspaceMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")

    def tearDown(self):
        self.db.close()

    def test_migration_runs_idempotently_and_creates_all_objects(self):
        sql = FINANCE_WORKSPACE_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        objects = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','index')"
        )}
        expected = {
            "finance_workspace_entries", "idx_finance_workspace_user",
            "idx_finance_workspace_ref", "finance_export_log",
            "idx_finance_export_user", "finance_resolution_cases",
            "idx_finance_resolution_user",
        }
        self.assertTrue(expected.issubset(objects))

    def test_migration_has_no_destructive_sql(self):
        sql = re.sub(
            r"--[^\n]*", "",
            FINANCE_WORKSPACE_MIGRATION.read_text(encoding="utf-8")
        ).upper()
        for forbidden in (
            r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b",
            r"\bDELETE\s+FROM\b", r"^\s*UPDATE\s+"
        ):
            self.assertIsNone(re.search(forbidden, sql, flags=re.MULTILINE))


OPERATIONAL_MIGRATION = ROOT / "migrations" / "0014_operational_schema.sql"


class OperationalMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")

    def tearDown(self):
        self.db.close()

    def test_migration_runs_idempotently_and_creates_all_objects(self):
        sql = OPERATIONAL_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        objects = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','index')"
        )}
        expected = {
            "action_outbox", "idx_action_outbox_status",
            "copilot_briefings", "idx_copilot_briefings_open",
            "loyalty_events", "loyalty_balances", "quality_events",
            "b2b_leads", "capacity_snapshots", "idx_capacity_date",
            "finance_forecasts", "system_checks",
        }
        self.assertTrue(expected.issubset(objects))
        columns = {row[1] for row in self.db.execute("PRAGMA table_info(action_outbox)")}
        self.assertTrue({"case_id", "processed_at"}.issubset(columns))

    def test_migration_preserves_action_idempotency_and_loyalty_uniqueness(self):
        self.db.executescript(OPERATIONAL_MIGRATION.read_text(encoding="utf-8"))
        self.db.execute(
            "INSERT INTO action_outbox(id,action_type,idempotency_key) VALUES('a1','TEST','same')"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO action_outbox(id,action_type,idempotency_key) VALUES('a2','TEST','same')"
            )
        self.db.execute(
            "INSERT INTO loyalty_balances(id,client_id,company_id) VALUES('l1','c1','co1')"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO loyalty_balances(id,client_id,company_id) VALUES('l2','c1','co1')"
            )

    def test_migration_has_no_destructive_sql(self):
        sql = re.sub(
            r"--[^\n]*", "",
            OPERATIONAL_MIGRATION.read_text(encoding="utf-8")
        ).upper()
        for forbidden in (
            r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b",
            r"\bDELETE\s+FROM\b", r"^\s*UPDATE\s+"
        ):
            self.assertIsNone(re.search(forbidden, sql, flags=re.MULTILINE))


NATIONAL_CONTINUITY_MIGRATION = ROOT / "migrations" / "0016_national_continuity_schema.sql"


class NationalContinuityMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")

    def tearDown(self):
        self.db.close()

    def test_migration_runs_idempotently_and_creates_all_objects(self):
        sql = NATIONAL_CONTINUITY_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        objects = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','index')"
        )}
        expected = {
            "platform_scale_config", "backup_runs", "backup_objects",
            "idx_backup_runs_date", "idx_backup_objects_run", "idx_scale_key",
        }
        self.assertTrue(expected.issubset(objects))

    def test_default_scale_settings_are_preserved_and_idempotent(self):
        self.db.executescript(NATIONAL_CONTINUITY_MIGRATION.read_text(encoding="utf-8"))
        self.db.execute(
            "UPDATE platform_scale_config SET value_json='75' WHERE key='maxPageSize'"
        )
        self.db.executescript(NATIONAL_CONTINUITY_MIGRATION.read_text(encoding="utf-8"))
        self.assertEqual(
            self.db.execute(
                "SELECT value_json FROM platform_scale_config WHERE key='maxPageSize'"
            ).fetchone()[0],
            "75",
        )
        self.assertEqual(
            self.db.execute("SELECT COUNT(*) FROM platform_scale_config").fetchone()[0],
            8,
        )

    def test_migration_has_no_destructive_sql(self):
        sql = re.sub(
            r"--[^\n]*", "",
            NATIONAL_CONTINUITY_MIGRATION.read_text(encoding="utf-8")
        ).upper()
        for forbidden in (
            r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b",
            r"\bDELETE\s+FROM\b", r"^\s*UPDATE\s+"
        ):
            self.assertIsNone(re.search(forbidden, sql, flags=re.MULTILINE))


COMMERCIAL_RECRUITMENT_MIGRATION = ROOT / "migrations" / "0015_commercial_recruitment_schema.sql"


class CommercialRecruitmentMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")

    def tearDown(self):
        self.db.close()

    def test_migration_runs_idempotently_and_creates_all_objects(self):
        sql = COMMERCIAL_RECRUITMENT_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        objects = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','index')"
        )}
        expected = {
            "commercial_prospects", "idx_commercial_prospects_priority",
            "commercial_playbooks", "recruitment_candidates",
            "idx_recruitment_candidates", "copilot_growth_actions", "sales_results",
        }
        self.assertTrue(expected.issubset(objects))

    def test_migration_has_no_destructive_sql(self):
        sql = re.sub(r"--[^\n]*", "", COMMERCIAL_RECRUITMENT_MIGRATION.read_text(encoding="utf-8")).upper()
        for forbidden in (r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b", r"\bDELETE\s+FROM\b"):
            self.assertIsNone(re.search(forbidden, sql))


BRAND_SUPPORT_COPILOT_MIGRATION = ROOT / "migrations" / "0017_brand_support_copilot_schema.sql"


class BrandSupportCopilotMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")

    def tearDown(self):
        self.db.close()

    def test_migration_runs_idempotently_and_seeds_required_controlled_defaults(self):
        sql = BRAND_SUPPORT_COPILOT_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        objects = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','index')"
        )}
        expected = {
            "brand_identity", "brand_assets", "brand_clearance_log",
            "interface_profiles", "support_cases", "support_case_events",
            "copilot_resolution_rules", "idx_support_cases_status",
            "idx_support_case_events_case", "idx_brand_assets_type", "idx_clearance_term",
        }
        self.assertTrue(expected.issubset(objects))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM interface_profiles").fetchone()[0], 4)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM copilot_resolution_rules").fetchone()[0], 10)
        self.assertEqual(
            self.db.execute("SELECT manager_approval_required FROM copilot_resolution_rules WHERE scenario_key='IDENTITY_SECURITY'").fetchone()[0],
            1,
        )

    def test_migration_has_no_destructive_sql(self):
        sql = re.sub(r"--[^\n]*", "", BRAND_SUPPORT_COPILOT_MIGRATION.read_text(encoding="utf-8")).upper()
        for forbidden in (r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b", r"\bDELETE\s+FROM\b", r"^\s*UPDATE\s+"):
            self.assertIsNone(re.search(forbidden, sql, flags=re.MULTILINE))


WALLET_GUARD_RESTORE_MIGRATION = ROOT / "migrations" / "0006_restore_wallet_balance_guard.sql"
UNIQUE_PROVIDER_ACCOUNT_MIGRATION = ROOT / "migrations" / "0007_unique_provider_account.sql"


class PaymentInvariantMigrationsTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript((ROOT / "migrations" / "0004_atomic_wallet_ledger.sql").read_text(encoding="utf-8"))
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def test_0006_restores_missing_wallet_guard_trigger(self):
        self.db.execute("DROP TRIGGER IF EXISTS trg_payment_wallet_ledger_guard_balances")
        sql = WALLET_GUARD_RESTORE_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        trigger = self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_payment_wallet_ledger_guard_balances'"
        ).fetchone()
        self.assertIsNotNone(trigger)
        self.db.execute(
            "INSERT INTO wallets(id,user_id,currency,pending_cents) VALUES('w1','u1','EUR',0)"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO payment_wallet_ledger(id,idempotency_key,user_id,entry_type,pending_delta_cents) VALUES('l1','i1','u1','TEST',-1)"
            )

    def test_0007_prevents_duplicate_nonempty_provider_account_ids(self):
        sql = UNIQUE_PROVIDER_ACCOUNT_MIGRATION.read_text(encoding="utf-8")
        self.db.executescript(sql)
        self.db.executescript(sql)
        self.db.execute(
            "INSERT INTO payment_accounts(id,user_id,provider,provider_account_id) VALUES('a1','u1','psp','acct_same')"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO payment_accounts(id,user_id,provider,provider_account_id) VALUES('a2','u2','psp','acct_same')"
            )
        self.db.execute(
            "INSERT INTO payment_accounts(id,user_id,provider,provider_account_id) VALUES('a3','u3','psp',NULL)"
        )
        self.db.execute(
            "INSERT INTO payment_accounts(id,user_id,provider,provider_account_id) VALUES('a4','u4','psp','')"
        )

    def test_0006_and_0007_are_non_destructive(self):
        for path in (WALLET_GUARD_RESTORE_MIGRATION, UNIQUE_PROVIDER_ACCOUNT_MIGRATION):
            sql = re.sub(r"--[^\n]*", "", path.read_text(encoding="utf-8")).upper()
            for forbidden in (r"\bDROP\s+TABLE\b", r"\bDROP\s+INDEX\b", r"\bDELETE\s+FROM\b", r"^\s*UPDATE\s+"):
                self.assertIsNone(re.search(forbidden, sql, flags=re.MULTILINE))
