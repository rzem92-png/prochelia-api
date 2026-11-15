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
            "UPDATE platform_settings SET value_json='\\"CUSTOM\\"' WHERE key='project_phase'"
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
