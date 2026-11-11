import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "index.js"


class AtomicRateLimitTests(unittest.TestCase):
    def test_counter_uses_single_atomic_upsert(self):
        source = SOURCE.read_text(encoding="utf-8")
        self.assertIn("ON CONFLICT(bucket,subject_hash,window_start)", source)
        self.assertIn("request_count=security_rate_limits.request_count+1", source)
        self.assertIn("RETURNING request_count", source)
        self.assertNotIn("request.headers.get('X-Forwarded-For')", source)
        self.assertNotIn('request.headers.get("X-Forwarded-For")', source)


    def test_cookie_authenticated_mutations_require_origin(self):
        source = SOURCE.read_text(encoding="utf-8")
        guard = source[source.index("function securityOriginAllowed"):source.index("async function ensureCommercialRecruitmentSchema")]
        self.assertIn("if(!origin) return !getCookie(request,SESSION_COOKIE);", guard)
        self.assertIn("getCookie(request,SESSION_COOKIE)", guard)



    def test_unique_provider_account_migration_prevents_duplicate_ownership(self):
        migration = ROOT / "migrations" / "0007_unique_provider_account.sql"
        db = sqlite3.connect(":memory:")
        try:
            db.execute("""
                CREATE TABLE payment_accounts (
                    id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE,
                    provider TEXT NOT NULL, provider_account_id TEXT
                )
            """)
            db.executescript(migration.read_text(encoding="utf-8"))
            db.execute(
                "INSERT INTO payment_accounts(id,user_id,provider,provider_account_id) VALUES('a1','u1','stripe','acct_shared')"
            )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "UNIQUE constraint failed"):
                db.execute(
                    "INSERT INTO payment_accounts(id,user_id,provider,provider_account_id) VALUES('a2','u2','stripe','acct_shared')"
                )
            db.execute(
                "INSERT INTO payment_accounts(id,user_id,provider,provider_account_id) VALUES('a3','u3','stripe',NULL)"
            )
            db.execute(
                "INSERT INTO payment_accounts(id,user_id,provider,provider_account_id) VALUES('a4','u4','stripe',NULL)"
            )
        finally:
            db.close()

    def test_wallet_balance_guard_migration_blocks_negative_balances_and_overflow(self):
        migration = ROOT / "migrations" / "0006_restore_wallet_balance_guard.sql"
        db = sqlite3.connect(":memory:")
        try:
            db.executescript("""
                CREATE TABLE wallets (
                    user_id TEXT PRIMARY KEY, currency TEXT NOT NULL,
                    available_cents INTEGER NOT NULL DEFAULT 0,
                    pending_cents INTEGER NOT NULL DEFAULT 0,
                    reserved_cents INTEGER NOT NULL DEFAULT 0,
                    paid_cents INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE payment_wallet_ledger (
                    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, currency TEXT NOT NULL,
                    available_delta_cents INTEGER NOT NULL DEFAULT 0,
                    pending_delta_cents INTEGER NOT NULL DEFAULT 0,
                    reserved_delta_cents INTEGER NOT NULL DEFAULT 0,
                    paid_delta_cents INTEGER NOT NULL DEFAULT 0
                );
            """)
            db.executescript(migration.read_text(encoding="utf-8"))
            db.execute("INSERT INTO wallets(user_id,currency) VALUES('u1','EUR')")
            with self.assertRaisesRegex(sqlite3.IntegrityError, "PAYMENT_WALLET_NEGATIVE_PROTECTED_BALANCE"):
                db.execute(
                    "INSERT INTO payment_wallet_ledger(id,user_id,currency,pending_delta_cents) VALUES('bad','u1','EUR',-1)"
                )
            db.execute(
                "UPDATE wallets SET available_cents=9223372036854775807 WHERE user_id='u1'"
            )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "PAYMENT_WALLET_INTEGER_OVERFLOW"):
                db.execute(
                    "INSERT INTO payment_wallet_ledger(id,user_id,currency,available_delta_cents) VALUES('overflow','u1','EUR',1)"
                )
            with self.assertRaisesRegex(sqlite3.IntegrityError, "PAYMENT_WALLET_NOT_FOUND"):
                db.execute(
                    "INSERT INTO payment_wallet_ledger(id,user_id,currency) VALUES('missing','u2','EUR')"
                )
        finally:
            db.close()

    def test_upsert_counts_every_request_without_lost_updates(self):
        db = sqlite3.connect(":memory:")
        try:
            db.execute("""
                CREATE TABLE security_rate_limits (
                    id TEXT PRIMARY KEY,
                    bucket TEXT NOT NULL,
                    subject_hash TEXT NOT NULL,
                    window_start TEXT NOT NULL,
                    request_count INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(bucket, subject_hash, window_start)
                )
            """)
            statement = """
                INSERT INTO security_rate_limits
                    (id,bucket,subject_hash,window_start,request_count)
                VALUES(?,?,?,?,1)
                ON CONFLICT(bucket,subject_hash,window_start)
                DO UPDATE SET request_count=security_rate_limits.request_count+1
                RETURNING request_count
            """
            counts = []
            for index in range(250):
                row = db.execute(
                    statement,
                    (f"id-{index}", "SENSITIVE:/api/auth/login", "subject", "2026-11-09T21:00:00Z"),
                ).fetchone()
                counts.append(row[0])
            self.assertEqual(counts, list(range(1, 251)))
            stored = db.execute("SELECT request_count FROM security_rate_limits").fetchone()[0]
            self.assertEqual(stored, 250)
        finally:
            db.close()

    def test_bootstrap_insert_is_single_winner(self):
        source = SOURCE.read_text(encoding="utf-8")
        self.assertIn("WHERE NOT EXISTS (SELECT 1 FROM users)", source)
        self.assertIn("RETURNING id", source)
        self.assertNotIn("SELECT COUNT(*) AS total FROM users", source[source.index("async function bootstrap"):source.index("async function authStatus")])

        db = sqlite3.connect(":memory:")
        try:
            db.execute("""
                CREATE TABLE users (
                    id TEXT PRIMARY KEY, role TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
                    first_name TEXT NOT NULL, last_name TEXT NOT NULL, phone TEXT,
                    status TEXT NOT NULL, password_hash TEXT NOT NULL
                )
            """)
            statement = """
                INSERT INTO users (id,role,email,first_name,last_name,phone,status,password_hash)
                SELECT ?, 'gerante', ?, ?, ?, ?, 'active', ?
                WHERE NOT EXISTS (SELECT 1 FROM users)
                RETURNING id
            """
            first = db.execute(statement, ("u1", "one@example.test", "One", "Admin", None, "hash1")).fetchone()
            second = db.execute(statement, ("u2", "two@example.test", "Two", "Admin", None, "hash2")).fetchone()
            self.assertEqual(first[0], "u1")
            self.assertIsNone(second)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM users").fetchone()[0], 1)
        finally:
            db.close()

    def test_login_throttle_uses_hashed_email_ip_and_ip_buckets(self):
        source = SOURCE.read_text(encoding="utf-8")
        login = source[source.index("async function ensureLoginSecuritySchema"):source.index("async function logout")]
        self.assertIn("LOGIN_EMAIL_IP:", login)
        self.assertIn("LOGIN_IP:", login)
        self.assertIn("CF-Connecting-IP", login)
        self.assertNotIn("request.headers.get('X-Forwarded-For')", login)
        self.assertIn("emailIpHash", login)
        self.assertIn("ipHash", login)
        self.assertIn("datetime('now','-15 minutes')", login)
        self.assertIn("retry_after_seconds:900", login)
        self.assertIn("DELETE FROM login_attempts WHERE key_hash=?", login)
        self.assertIn("SELECT ?,? WHERE (SELECT COUNT(*)", login)

    def test_login_throttle_limits_five_identity_attempts_and_twenty_five_ip_attempts(self):
        db = sqlite3.connect(":memory:")
        try:
            db.execute("""
                CREATE TABLE login_attempts (
                    id TEXT PRIMARY KEY,
                    key_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            insert = """
                INSERT INTO login_attempts (id,key_hash)
                SELECT ?,? WHERE (
                    SELECT COUNT(*) FROM login_attempts
                    WHERE key_hash=? AND created_at>=datetime('now','-15 minutes')
                ) < ?
            """
            email_results = []
            for index in range(7):
                row = db.execute(insert, (f"e-{index}", "email-ip-hash", "email-ip-hash", 5))
                email_results.append(row.rowcount)
            self.assertEqual(email_results, [1, 1, 1, 1, 1, 0, 0])
            ip_results = []
            for index in range(27):
                row = db.execute(insert, (f"ip-{index}", "ip-hash", "ip-hash", 25))
                ip_results.append(row.rowcount)
            self.assertEqual(sum(ip_results), 25)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM login_attempts WHERE key_hash='ip-hash'").fetchone()[0], 25)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
