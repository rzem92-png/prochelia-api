#!/usr/bin/env bash
set -euo pipefail
restore=".github/workflows/restore-preview-d1-test-v2.yml"
backup=".github/workflows/backup-preview-d1.yml"
config="wrangler.restore-test-v2.jsonc"
fail(){ echo "::error::$1"; exit 1; }

test -s "$restore" || fail "Restore workflow missing"
test -s "$backup" || fail "Backup workflow missing"
test -s "$config" || fail "Isolated restore config missing"

grep -Fq 'RESTORE_DB_NAME: prochelia-restore-test-v2' "$restore" || fail "Restore DB name guard missing"
grep -Fq 'RESTORE_DB_ID: a3526c2a-39cb-49ab-97c4-979138145f33' "$restore" || fail "Restore DB UUID guard missing"
grep -Fq '"name": "prochelia-restore-test-v2"' "$config" || fail "Restore Wrangler config name mismatch"
grep -Fq '"database_id": "a3526c2a-39cb-49ab-97c4-979138145f33"' "$config" || fail "Restore Wrangler config UUID mismatch"
grep -Fq 'database=prochelia-preview-db' "$restore" || fail "Backup source database check missing"
grep -Fq 'sha256_sql=' "$backup" || fail "Backup SHA-256 manifest missing"
grep -Fq 'expected_sha="$(sed -n ' "$restore" || fail "Restore must reload SHA-256 from manifest in its own step"
grep -Fq 'actual_sha="$(sha256sum "$sql"' "$restore" || fail "Restore SHA-256 verification missing"
grep -Fq '[[ "$actual_sha" == "$expected_sha" ]]' "$restore" || fail "Restore hash equality guard missing"

# Every remote D1 execution must be explicitly pinned to the isolated config.
exec_count="$(grep -Fc -- '--config wrangler.restore-test-v2.jsonc d1 execute' "$restore")"
[[ "$exec_count" -ge 5 ]] || fail "Expected at least five isolated-config D1 execute commands; found $exec_count"
if grep -E 'wrangler@4 d1 execute' "$restore" >/dev/null; then
  fail "Found an unpinned Wrangler D1 command"
fi

grep -Fq "0005_security_rate_limits.sql" "$restore" || fail "Expected migration manifest missing"
grep -Fq 'migration_count == 5 and .expected_migration_count == 5' "$restore" || fail "Migration count verification missing"
grep -Fq 'length >= 23' "$restore" || fail "Minimum table-count guard missing"
grep -Fq 'required_table_count == 23' "$restore" || fail "Required core tables verification missing"
grep -Fq 'minimum 23 tables' "$restore" || fail "Non-brittle table count message missing"
grep -Fq 'retention-days: 30' "$backup" || fail "Backup artifact retention setting missing"
echo "PASS: D1 backup/restore workflow static safety gates"
