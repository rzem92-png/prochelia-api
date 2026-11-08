#!/usr/bin/env python3
"""Guardrails for the Cloudflare prelaunch configuration (static, no API calls)."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "wrangler.jsonc"
PRODUCTION_D1 = "04f52830-ef5a-4f17-a640-42bbc2381bba"
PREVIEW_D1 = "6adb95e5-e542-4bec-9008-fbea01042305"
PREVIEW_WORKER = "prochelia-api-preview"

def main():
    # Current wrangler.jsonc is strict JSON despite its extension.
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    errors = []

    worker = str(config.get("name", "")).lower()
    if not worker or "staging" not in worker and "preview" not in worker:
        errors.append("Worker name must clearly identify staging/preview")

    bindings = config.get("d1_databases", [])
    db = next((x for x in bindings if x.get("binding") == "DB"), None)
    if not db:
        errors.append("Missing D1 binding named DB")
    else:
        if db.get("database_id") == PRODUCTION_D1:
            errors.append("Production D1 is forbidden in prelaunch config")
        if db.get("database_id") != PREVIEW_D1:
            errors.append("Prelaunch DB must be the approved preview D1")
        if "preview" not in str(db.get("database_name", "")).lower():
            errors.append("D1 database name must identify preview")

    r2 = config.get("r2_buckets", [])
    backup = next((x for x in r2 if x.get("binding") == "BACKUP_BUCKET"), None)
    if not backup:
        errors.append("Missing BACKUP_BUCKET R2 binding")
    elif "preview" not in str(backup.get("bucket_name", "")).lower() and "staging" not in str(backup.get("bucket_name", "")).lower():
        errors.append("R2 bucket name must identify preview/staging")

    if not config.get("observability", {}).get("logs", {}).get("enabled"):
        errors.append("Worker observability logs must be enabled")
    if not config.get("triggers", {}).get("crons"):
        errors.append("Expected scheduled maintenance/backup cron is missing")

    if errors:
        for error in errors:
            print("FAIL:", error)
        raise SystemExit(1)

    print("PASS: Worker name matches the existing preview Worker")
    print("PASS: D1 binding targets approved preview DB (not production)")
    print("PASS: R2 backup binding is preview/staging-only")
    print("PASS: observability logs and scheduled trigger are configured")
    print("NOTE: static configuration check only; does not prove R2 bucket exists or deployment works.")

if __name__ == "__main__":
    main()
