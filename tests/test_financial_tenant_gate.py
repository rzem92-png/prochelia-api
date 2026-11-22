from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "src" / "index.js").read_text(encoding="utf-8")


def test_production_gate_requires_tenant_scope_for_every_financial_table():
    assert "const tenantScopedTables=['missions','wallets','payment_transactions','payment_accounts','payout_requests','payment_disputes','payment_wallet_ledger','payment_reconciliation','finance_workspace_entries','finance_export_log','finance_resolution_cases'];" in SOURCE
    assert "code:'FINANCIAL_TENANT_SCOPE'" in SOURCE
    assert "status:tenantScopeChecks.every(x=>x.status==='OK')?'OK':'INCOMPLETE'" in SOURCE
    assert "checks.filter(x=>['MISSING','INCOMPLETE'].includes(x.status))" in SOURCE


def test_production_gate_requires_wallet_and_payout_schema():
    required_tables = SOURCE.split("const requiredTables=[", 1)[1].split("];", 1)[0]
    assert "'payment_accounts'" in required_tables
    assert "'wallets'" in required_tables
    assert "'payout_requests'" in required_tables

    assert "'finance_workspace_entries'" in required_tables
    assert "'finance_export_log'" in required_tables
    assert "'finance_resolution_cases'" in required_tables
    assert "'finance_workspace_entries','finance_export_log','finance_resolution_cases'" in SOURCE
