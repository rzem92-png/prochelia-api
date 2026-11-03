import sqlite3
import unittest


class CopilotAtomicClaimSqliteTests(unittest.TestCase):
    """SQL regression tests for conditional case/outbox claims.

    These tests model the exact state-transition predicates used by src/index.js.
    They do not replace Worker integration tests against D1.
    """

    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript("""
            CREATE TABLE operational_cases(
              id TEXT PRIMARY KEY, status TEXT NOT NULL,
              requires_manager INTEGER NOT NULL DEFAULT 1
            );
            INSERT INTO operational_cases VALUES('case-1','OPEN',1);

            CREATE TABLE action_outbox(
              id TEXT PRIMARY KEY, status TEXT NOT NULL,
              attempts INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO action_outbox VALUES('outbox-1','PENDING',0);
        """)
        self.db.commit()

    def claim_case(self, case_id="case-1", statuses=("OPEN", "AUTO_PENDING")):
        marks = ",".join("?" for _ in statuses)
        cursor = self.db.execute(
            f"UPDATE operational_cases SET status='EXECUTING' "
            f"WHERE id=? AND status IN ({marks})",
            (case_id, *statuses),
        )
        self.db.commit()
        return cursor.rowcount

    def claim_outbox(self, action_id="outbox-1"):
        cursor = self.db.execute("""
            UPDATE action_outbox
               SET status='PROCESSING', attempts=attempts+1
             WHERE id=? AND status='PENDING'
        """, (action_id,))
        self.db.commit()
        return cursor.rowcount

    def test_two_approvals_cannot_claim_same_case(self):
        # Both requests may have read OPEN before either attempts this claim.
        results = [self.claim_case(), self.claim_case()]
        self.assertEqual(results, [1, 0])
        self.assertEqual(
            self.db.execute("SELECT status FROM operational_cases WHERE id='case-1'").fetchone()[0],
            "EXECUTING",
        )

    def test_automatic_claim_only_accepts_auto_pending(self):
        self.db.execute("UPDATE operational_cases SET status='OPEN' WHERE id='case-1'")
        self.db.commit()
        self.assertEqual(self.claim_case(statuses=("AUTO_PENDING",)), 0)
        self.db.execute("UPDATE operational_cases SET status='AUTO_PENDING' WHERE id='case-1'")
        self.db.commit()
        self.assertEqual(self.claim_case(statuses=("AUTO_PENDING",)), 1)
        self.assertEqual(self.claim_case(statuses=("AUTO_PENDING",)), 0)

    def test_two_outbox_workers_cannot_claim_same_pending_item(self):
        # Both workers can fetch the same PENDING row; the conditional UPDATE
        # decides which worker owns it, not the preceding SELECT.
        results = [self.claim_outbox(), self.claim_outbox()]
        self.assertEqual(results, [1, 0])
        row = self.db.execute(
            "SELECT status, attempts FROM action_outbox WHERE id='outbox-1'"
        ).fetchone()
        self.assertEqual(row, ("PROCESSING", 1))

    def test_outbox_claim_does_not_reclaim_processing_or_terminal_rows(self):
        for status in ("PROCESSING", "COMPLETED", "WAITING_PROVIDER", "FAILED"):
            self.db.execute("UPDATE action_outbox SET status=?, attempts=0 WHERE id='outbox-1'", (status,))
            self.db.commit()
            self.assertEqual(self.claim_outbox(), 0, status)
            self.assertEqual(
                self.db.execute("SELECT attempts FROM action_outbox WHERE id='outbox-1'").fetchone()[0],
                0,
            )

    def test_case_terminal_state_cannot_be_claimed_again(self):
        for status in ("RESOLVED", "CLOSED", "EXECUTING"):
            self.db.execute("UPDATE operational_cases SET status=? WHERE id='case-1'", (status,))
            self.db.commit()
            self.assertEqual(self.claim_case(), 0, status)

    def test_auto_case_claim_checks_phase_inside_atomic_update(self):
        self.db.executescript("""
            CREATE TABLE platform_settings(
              key TEXT PRIMARY KEY, value_json TEXT NOT NULL
            );
            INSERT INTO platform_settings(key,value_json)
              VALUES('project_phase','"EXPERT"');
            UPDATE operational_cases SET status='AUTO_PENDING';
        """)
        sql = """
            UPDATE operational_cases SET status='EXECUTING'
             WHERE id='case-1' AND status='AUTO_PENDING'
               AND EXISTS (
                 SELECT 1 FROM platform_settings
                  WHERE key='project_phase'
                    AND UPPER(TRIM(json_extract(value_json, '


if __name__ == "__main__":
    unittest.main()
))) = ?
               )
        """
        self.db.execute(
            "UPDATE platform_settings SET value_json=? WHERE key='project_phase'",
            ('"PRODUCTION"',),
        )
        self.db.commit()
        rejected = self.db.execute(sql, ("EXPERT",))
        self.db.commit()
        self.assertEqual(rejected.rowcount, 0)
        self.assertEqual(
            self.db.execute("SELECT status FROM operational_cases WHERE id='case-1'").fetchone()[0],
            "AUTO_PENDING",
        )
        self.db.execute(
            "UPDATE platform_settings SET value_json=? WHERE key='project_phase'",
            ('"EXPERT"',),
        )
        self.db.commit()
        accepted = self.db.execute(sql, ("EXPERT",))
        self.db.commit()
        self.assertEqual(accepted.rowcount, 1)

    def tearDown(self):
        self.db.close()


if __name__ == "__main__":
    unittest.main()
