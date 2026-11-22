#!/usr/bin/env python3
"""Fail-closed contract tests for the guarded Preview D1 migration workflow."""

from pathlib import Path

workflow = Path(".github/workflows/apply-preview-d1-migrations.yml").read_text()

required_fragments = {
    "manual-only dispatch": "workflow_dispatch:",
    "explicit Preview acknowledgement": "APPLY_PREVIEW_ONLY",
    "main-branch execution gate": "github.ref == 'refs/heads/main'",
    "single canonical Preview database": "EXPECTED_DB_ID: e3cf167c-37e1-4d72-9ac6-b3e27c14b97f",
    "production database deny-list": "FORBIDDEN_PRODUCTION_DB_ID: 04f52830-ef5a-4f17-a640-42bbc2381bba",
    "EU jurisdiction request": "-H 'cf-r2-jurisdiction: eu'",
    "EU jurisdiction response verification": ".result.jurisdiction == \"eu\"",
    "fresh SQLite restore": 'sqlite3 "$RUNNER_TEMP/prochelia-backup/restore-validation-r2.sqlite" < "$RUNNER_TEMP/prochelia-backup/roundtrip.sql"',
    "SQLite integrity verification": "PRAGMA integrity_check;",
    "integrity must equal ok": 'test "$integrity" = "ok"',
}

missing = [label for label, fragment in required_fragments.items() if fragment not in workflow]
if missing:
    raise SystemExit("FAIL: Preview migration workflow lost required safety controls: " + ", ".join(missing))

# Keep the production target explicitly forbidden and ensure migration execution
# cannot be triggered by a normal pull_request or push event.
dispatch_section = workflow.split("on:", 1)[1].split("\npermissions:", 1)[0]
if "pull_request:" in dispatch_section or "push:" in dispatch_section:
    raise SystemExit("FAIL: guarded Preview migration workflow must remain manual-only")

print(f"PASS: {len(required_fragments)} fail-closed Preview migration and R2 restore controls verified.")
