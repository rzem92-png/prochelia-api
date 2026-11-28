# Compliance source register — evidence readiness audit (2026-11-28)

## Evidence scope
Reviewed PR #474 (exhaustive territory coverage) and PR #475 (exact official-host allowlist), their diffs, tests, and CI runs.

## Verified safeguards
- Register must explicitly partition a fixed territory list between researched and not researched.
- Missing, duplicate, unknown, misclassified or incomplete territory entries block metadata validation.
- Source jurisdictions must be in the fixed territory set and match register coverage.
- Source URLs use an exact curated HTTPS host allowlist, no arbitrary subdomain suffix trust, no credentials and no non-standard port.
- Register does not authorize market activation, legal approval, or claim control implementation verification.
- Legal review remains pending counsel; controls remain unverified; market activation is false.

## Evidence
PR #474 head `3be68ebae43f8b097e895904658c7f8787ca8662`: compliance register workflow, V7 security regression, and Worker build all completed SUCCESS.
PR #475 head `bb78ac1e1cabf765251c4399a139265619046e70`: compliance register workflow, V7 security regression, and Worker build all completed SUCCESS.

## Remaining gaps — not a legal certification
### C-01 — Research coverage remains incomplete
The tests assert only 3 researched jurisdictions and 13 explicitly not researched. This is fail-closed and correctly prevents claiming exhaustive legal readiness, but it is insufficient for international launch.

### C-02 — Source metadata is not reproducible source evidence
The metadata records URL, access level, status, checked dates and evidence note, but the reviewed guard does not establish archived immutable source snapshots, cryptographic content hash, quoted clause/section, version/consolidation status or reproducible retrieval. A source could change after review or a search result may be misinterpreted.

**Required:** store an immutable evidence artifact or controlled snapshot, SHA-256, exact section/article, official publication/consolidation date, retrieval timestamp, source version and reviewer notes; distinguish PAGE_OPENED from actual text verified and keep SEARCH_RESULT_ONLY as discovery-only.

### C-03 — Legal applicability and control mapping not validated
Territory/activity/control IDs are metadata, not a legal applicability analysis. No automated register may certify that a rule applies to the exact platform model, user role, data flow or business activity.

**Required:** counsel/local expert review per market and activity; map obligations to implemented controls, owner, test, evidence, effective date, exceptions, enforcement and remediation; record signed approval and expiry.

### C-04 — Change monitoring and review process not demonstrated
Review-due dates are validated, but no demonstrated continuous official-source monitoring, change-impact assessment, alerting, owner assignment, or emergency compliance kill switch is evidenced by these PRs.

**Required:** scheduled monitoring, alert triage, change log, severity classification, affected journeys/markets, temporary block, remediation deadline, and accountable sign-off.

## Release decision
**NO-GO for market activation or legal-compliance claims.** Register validation only confirms metadata integrity. No launch authorization, legal certification, production action or data change was performed.
