from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
config_text = (ROOT / "wrangler.production-backup.jsonc").read_text()
workflow = (ROOT / ".github/workflows/backup-production-d1-to-r2.yml").read_text()

# The pinned JSONC file uses full-line // comments only; mirror the workflow parser.
config = json.loads("\n".join(
    line for line in config_text.splitlines()
    if not line.lstrip().startswith("//")
))

def env_value(name: str) -> str:
    match = re.search(rf"^\s+{re.escape(name)}:\s+([A-Za-z0-9_-]+)\s*$", workflow, re.MULTILINE)
    assert match, f"Missing workflow constant: {name}"
    return match.group(1)

databases = config.get("d1_databases")
assert isinstance(databases, list) and len(databases) == 1, "Exactly one D1 target must be pinned"
database = databases[0]

assert database.get("binding") == "DB", "Backup binding must be DB"
assert database.get("database_name") == env_value("EXPECTED_DB_NAME"), "Wrangler D1 name and workflow name differ"
assert database.get("database_id") == env_value("EXPECTED_DB_ID"), "Wrangler D1 UUID and workflow UUID differ"
assert env_value("EXPECTED_DB_NAME") == "prochelia-db", "Unexpected production D1 name"
assert env_value("EXPECTED_DB_ID") == "04f52830-ef5a-4f17-a640-42bbc2381bba", "Unexpected production D1 UUID"
assert env_value("R2_BUCKET") == "prochelia-production-backups-eu", "Production backup bucket must remain isolated"

required_guards = [
    'github.event.inputs.confirm_production_backup == \'BACKUP_PRODUCTION_D1\'',
    'test "$GITHUB_REF" = "refs/heads/main"',
    'wrangler@4 d1 export "$EXPECTED_DB_NAME" --remote --config wrangler.production-backup.jsonc',
    "PRAGMA integrity_check;",
    "Verify live production D1 name and UUID through Cloudflare API",
    "api.cloudflare.com/client/v4/accounts/$EXPECTED_ACCOUNT_ID/d1/database/$EXPECTED_DB_ID",
    "database[\"uuid\"] == sys.argv[2]",
    "--cipher-algo AES256",
    "roundtrip.sql.gpg",
    'test "$actual" = "$expected"',
]
for guard in required_guards:
    assert guard in workflow, f"Missing backup safety/integrity guard: {guard}"

for forbidden in ["d1 migrations apply", "wrangler deploy", "d1 database delete", "d1 execute"]:
    assert forbidden not in workflow, f"Unexpected mutating production command: {forbidden}"

print("PASS: production D1 backup target, account gates, encryption and R2 round-trip guards are consistent.")
