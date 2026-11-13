import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "prepare-d1-restore.py"


class PrepareD1RestoreTests(unittest.TestCase):
    def test_parent_before_child_and_schema_after_data(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source.sqlite"
            output = root / "restore.sql"
            target = root / "target.sqlite"

            db = sqlite3.connect(source)
            db.execute("PRAGMA foreign_keys=ON")
            db.executescript("""
                CREATE TABLE parents (id TEXT PRIMARY KEY, label TEXT NOT NULL);
                CREATE TABLE children (
                    id TEXT PRIMARY KEY,
                    parent_id TEXT NOT NULL REFERENCES parents(id),
                    label TEXT NOT NULL
                );
                CREATE INDEX idx_children_parent ON children(parent_id);
                CREATE TABLE audit (id INTEGER PRIMARY KEY, action TEXT NOT NULL);
                CREATE TRIGGER children_audit AFTER INSERT ON children
                BEGIN INSERT INTO audit(action) VALUES ('child inserted'); END;
                CREATE VIEW child_labels AS SELECT label FROM children;
                INSERT INTO parents VALUES ('p1', 'parent');
                INSERT INTO children VALUES ('c1', 'p1', 'child');
            """)
            db.commit()
            db.close()

            subprocess.run(
                [sys.executable, str(SCRIPT), "--source", str(source), "--output", str(output)],
                check=True,
                capture_output=True,
                text=True,
            )
            sql = output.read_text(encoding="utf-8")
            self.assertNotIn("BEGIN TRANSACTION", sql.upper())
            self.assertLess(sql.index("INSERT INTO \"parents\""), sql.index("INSERT INTO \"children\""))
            self.assertGreater(sql.index("CREATE INDEX idx_children_parent"), sql.index("INSERT INTO \"children\""))
            self.assertGreater(sql.index("CREATE TRIGGER children_audit"), sql.index("INSERT INTO \"children\""))
            self.assertIn("CREATE VIEW child_labels", sql)

            restored = sqlite3.connect(target)
            restored.execute("PRAGMA foreign_keys=ON")
            restored.executescript(sql)
            self.assertEqual(restored.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(restored.execute("PRAGMA foreign_key_check").fetchall(), [])
            self.assertEqual(restored.execute("SELECT COUNT(*) FROM children").fetchone()[0], 1)
            self.assertEqual(restored.execute("SELECT COUNT(*) FROM audit").fetchone()[0], 1)
            restored.execute("INSERT INTO children VALUES ('c2', 'p1', 'child 2')")
            self.assertEqual(restored.execute("SELECT COUNT(*) FROM audit").fetchone()[0], 2)
            restored.close()

    def test_circular_foreign_key_graph_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "cycle.sqlite"
            output = root / "restore.sql"
            db = sqlite3.connect(source)
            db.executescript("""
                CREATE TABLE alpha (id TEXT PRIMARY KEY, beta_id TEXT REFERENCES beta(id));
                CREATE TABLE beta (id TEXT PRIMARY KEY, alpha_id TEXT REFERENCES alpha(id));
            """)
            db.close()
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--source", str(source), "--output", str(output)],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Circular foreign-key dependency", result.stderr)
            self.assertFalse(output.exists())

    def test_source_foreign_key_violations_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "orphan.sqlite"
            output = root / "restore.sql"
            db = sqlite3.connect(source)
            db.executescript("""
                CREATE TABLE parents (id TEXT PRIMARY KEY);
                CREATE TABLE children (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parents(id));
                INSERT INTO children VALUES ('orphan', 'missing-parent');
            """)
            db.close()
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--source", str(source), "--output", str(output)],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("foreign-key violation", result.stderr)
            self.assertFalse(output.exists())

    def test_d1_migrations_autoincrement_is_preserved_without_sqlite_sequence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source.sqlite"
            output = root / "restore.sql"
            target = root / "target.sqlite"

            db = sqlite3.connect(source)
            db.executescript("""
                CREATE TABLE d1_migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                );
                INSERT INTO d1_migrations (id, name, applied_at)
                VALUES (1, '0001_initial.sql', '2026-10-01 12:00:00'),
                       (7, '0007_finance.sql', '2026-11-01 12:00:00');
            """)
            db.commit()
            db.close()

            subprocess.run(
                [sys.executable, str(SCRIPT), "--source", str(source), "--output", str(output)],
                check=True,
                capture_output=True,
                text=True,
            )
            sql = output.read_text(encoding="utf-8")
            self.assertRegex(sql, r'(?im)^CREATE TABLE d1_migrations\s*\(')
            self.assertIn('INTEGER PRIMARY KEY AUTOINCREMENT', sql)
            self.assertIn('INSERT INTO "d1_migrations" ("id", "name", "applied_at") VALUES (7,', sql)

            restored = sqlite3.connect(target)
            restored.executescript(sql)
            self.assertEqual(
                restored.execute("SELECT id, name FROM d1_migrations ORDER BY id").fetchall(),
                [(1, "0001_initial.sql"), (7, "0007_finance.sql")],
            )
            self.assertEqual(restored.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(restored.execute("SELECT seq FROM sqlite_sequence WHERE name='d1_migrations'").fetchone()[0], 7)
            restored.close()


if __name__ == "__main__":
    unittest.main()
