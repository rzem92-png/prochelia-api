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


if __name__ == "__main__":
    unittest.main()
