import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateAccountPayload, validateJournalPayload, handleAccountingRoute } from "../src/accounting-api.js";

const balanced = {
  entity_id: "entity-a",
  idempotency_key: "journal-001",
  journal_date: "2026-11-22",
  currency: "EUR",
  source_type: "MANUAL",
  source_id: "manual-001",
  description: "Opening cash",
  lines: [
    { account_id: "cash", side: "DEBIT", amount_cents: 10000 },
    { account_id: "capital", side: "CREDIT", amount_cents: 10000 }
  ]
};

test("journal validator accepts balanced integer-cent entries and rejects imbalanced entries", () => {
  const ok = validateJournalPayload(balanced);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.debit, 10000);
  assert.equal(ok.value.credit, 10000);
  const bad = validateJournalPayload({ ...balanced, lines: [
    { account_id: "cash", side: "DEBIT", amount_cents: 10001 },
    { account_id: "capital", side: "CREDIT", amount_cents: 10000 }
  ]});
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "JOURNAL_NOT_BALANCED");
});

test("journal validator rejects float amounts, invalid dates, missing idempotency and excessive lines", () => {
  assert.equal(validateJournalPayload({ ...balanced, lines: [
    { account_id: "cash", side: "DEBIT", amount_cents: 1.5 },
    { account_id: "capital", side: "CREDIT", amount_cents: 1.5 }
  ]}).error, "JOURNAL_LINE_INVALID");
  assert.equal(validateJournalPayload({ ...balanced, journal_date: "2026-02-30" }).error, "JOURNAL_DATE_INVALID");
  assert.equal(validateJournalPayload({ ...balanced, idempotency_key: "" }).error, "IDEMPOTENCY_KEY_REQUIRED");
  assert.equal(validateJournalPayload({ ...balanced, lines: Array(101).fill(balanced.lines[0]) }).error, "JOURNAL_LINES_INVALID");
});

test("account validator accepts only supported account types and normal balances", () => {
  assert.equal(validateAccountPayload({
    entity_id: "entity-a", idempotency_key: "account-1", account_code: "512000",
    account_name: "Bank", account_type: "ASSET", normal_balance: "DEBIT"
  }).ok, true);
  assert.equal(validateAccountPayload({
    entity_id: "entity-a", idempotency_key: "account-2", account_code: "512000",
    account_name: "Bank", account_type: "MAGIC", normal_balance: "DEBIT"
  }).error, "ACCOUNT_TYPE_INVALID");
});

test("accounting routes fail closed when the canonical ledger schema is absent", async () => {
  const DB = { prepare() { return { bind() { return this; }, async all() { return { success: true, results: [{ name: "accounting_entities" }] }; } }; }, batch: async () => [] };
  const response = await handleAccountingRoute(new Request("https://api.example.test/api/accounting/entities"), { DB },
    { user: { id: "user-a" }, tenant: { id: "tenant-a", role: "OWNER" } });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "ACCOUNTING_SCHEMA_NOT_MIGRATED");
});

test("accounting routes reject missing tenant context before any D1 access", async () => {
  let calls = 0;
  const DB = { prepare() { calls++; throw new Error("should not query"); }, batch: async () => [] };
  const response = await handleAccountingRoute(new Request("https://api.example.test/api/accounting/entities"), { DB },
    { user: { id: "user-a" } });
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
});

test("unknown accounting routes return 404 after tenant and schema gates", async () => {
  const DB = { prepare() { return { bind() { return this; }, async all() { return { success: true, results: [
    { name: "accounting_entities" }, { name: "accounting_accounts" },
    { name: "accounting_journals" }, { name: "accounting_journal_lines" }
  ] }; } }; }, batch: async () => [] };
  const response = await handleAccountingRoute(new Request("https://api.example.test/api/accounting/unknown"), { DB },
    { user: { id: "user-a" }, tenant: { id: "tenant-a", role: "OWNER" } });
  assert.equal(response.status, 404);
});


test("accounting mutations fail closed before any D1 query until human and expert approval exists", async () => {
  let calls = 0;
  const DB = { prepare() { calls++; throw new Error("mutating route must not access D1"); }, batch: async () => [] };
  const response = await handleAccountingRoute(new Request("https://api.example.test/api/accounting/journals", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(balanced)
  }), { DB }, { user: { id: "user-a" }, tenant: { id: "tenant-a", role: "OWNER" } });
  assert.equal(response.status, 405);
  assert.equal((await response.json()).error, "ACCOUNTING_WRITES_DISABLED_PENDING_HUMAN_AND_EXPERT_REVIEW");
  assert.equal(calls, 0);
});

test("accounting schema readiness rejects unsuccessful D1 results even when partial rows look complete", async () => {
  const DB = { prepare() { return { bind() { return this; }, async all() {
    return { success: false, results: [
      { name: "accounting_entities" }, { name: "accounting_accounts" },
      { name: "accounting_journals" }, { name: "accounting_journal_lines" }
    ] };
  } }; }, batch: async () => [] };
  const response = await handleAccountingRoute(new Request("https://api.example.test/api/accounting/health"), { DB },
    { user: { id: "user-a" }, tenant: { id: "tenant-a", role: "READ_ONLY" } });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "ACCOUNTING_SCHEMA_UNAVAILABLE");
});

test("accounting routes are wired through authenticated server-side tenant context", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.ok(source.includes('import { handleAccountingRoute } from "./accounting-api.js";'));
  assert.ok(source.includes("url.pathname.startsWith('/api/accounting/')"));
  assert.ok(source.includes("resolveTenantContext(request, env, accountingAuth)"));
  assert.ok(source.includes("tenant: accountingContext.tenant"));
});


test("trial balance sums only lines belonging to posted journals on or before the as-of date", async () => {
  let trialBalanceSql = "";
  const required = [
    "accounting_entities", "accounting_accounts",
    "accounting_journals", "accounting_journal_lines"
  ];
  const DB = {
    prepare(sql) {
      return {
        sql,
        bind() { return this; },
        async all() {
          if (sql.includes("sqlite_master")) {
            return { success: true, results: required.map(name => ({ name })) };
          }
          if (sql.includes("SELECT a.id AS account_id")) {
            trialBalanceSql = sql;
            return { success: true, results: [{
              account_id: "cash", account_code: "512000", account_name: "Bank",
              account_type: "ASSET", normal_balance: "DEBIT",
              debit_cents: 10000, credit_cents: 0
            }] };
          }
          throw new Error("Unexpected accounting query: " + sql);
        },
        async first() {
          return { id: "entity-a", tenant_id: "tenant-a", status: "ACTIVE", base_currency: "EUR" };
        }
      };
    },
    batch: async () => []
  };
  const response = await handleAccountingRoute(
    new Request("https://api.example.test/api/accounting/trial-balance?entity_id=entity-a&as_of=2026-11-22"),
    { DB },
    { user: { id: "reader-a" }, tenant: { id: "tenant-a", role: "READ_ONLY" } }
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.accounts[0].debit_cents, 10000);
  assert.match(trialBalanceSql, /CASE WHEN j[.]id IS NOT NULL AND l[.]side='DEBIT'/);
  assert.match(trialBalanceSql, /CASE WHEN j[.]id IS NOT NULL AND l[.]side='CREDIT'/);
  assert.match(trialBalanceSql, /j[.]status='POSTED' AND j[.]journal_date<=[?]/);
});
