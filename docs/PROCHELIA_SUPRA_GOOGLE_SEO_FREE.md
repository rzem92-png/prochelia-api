# PROCHÉLIA — SUPRA SEO & Google Search, free organic discovery

**Status: design/requirements for preproduction.** This file does not register a domain, access Google accounts, publish live content, or guarantee rankings. Existing remembered preview URLs: `prochelia.pages.dev` and `prochelia.rzem92.workers.dev`. Canonical domain must be confirmed from DNS/ownership before production SEO setup.

## Product goal
SUPRA should operate as a reasoned SEO/Growth co-pilot for PROCHÉLIA: analyze authorized public data, explain decisions, propose and prepare improvements, measure outcomes, and continuously prioritize the highest-value safe tasks. It must not promise #1 ranking or “instant indexing”.

## Free Google stack (where eligible)
- Google Search Console: verify domain/property ownership, submit sitemap, inspect indexing status, review queries/pages/clicks/impressions and alerts.
- Google Analytics only if wanted and correctly consent-configured; prefer privacy-minimal measurement. Search Console does not require Analytics.
- Google Business Profile only if PROCHÉLIA meets Google’s eligibility rules for a real business/customer-facing operation. Do not create fake offices, duplicate profiles, or list a virtual office. Service-area business/address visibility must follow Google policy.
- Google Trends and free Search Console data for demand/topic research. Use official sources and preserve date/locale.
- No purchased links, automated spam, fake reviews, doorway pages, keyword stuffing, or mass-generated thin pages.

## Technical SEO checklist (site/PWA)
1. Canonical hostname and HTTPS, redirect variants (www/non-www, http→https), no duplicate canonical URLs.
2. Server-rendered/static crawlable HTML for key landing pages; ensure content does not require JS execution to be visible/indexable.
3. Unique title, meta description, H1, useful page copy, descriptive internal links and image alt text per page.
4. `robots.txt` and XML sitemap: only canonical, public, indexable URLs; exclude private dashboards, auth, booking personal data, APIs, staging and noindex pages.
5. Correct status codes, no redirect chains/loops, no broken links, custom 404, canonical tags, hreflang only for genuinely translated equivalents.
6. Structured data only where accurate (Organization, WebSite, BreadcrumbList; LocalBusiness only when eligible and truthful). No fabricated reviews, ratings, prices or address.
7. Mobile-first performance, accessibility, Core Web Vitals, image compression, cache headers and security headers.
8. Privacy: no client/intervenant personal data in URLs, page titles, analytics, logs, sitemap or indexed content.
9. Indexable service/area pages only when genuinely useful and service available; no city-page spam or duplicate template pages.
10. Separate preproduction from production: staging should be authenticated or noindex; no sitemap submission for staging.

## SUPRA SEO reasoning loop
- Observe: Search Console, site crawl, analytics only with consent, page availability, legitimate public trends, support feedback (aggregated).
- Ground: each insight includes source, URL, capture time, locale, confidence and freshness; separate fact from hypothesis.
- Diagnose: detect technical issue, intent mismatch, page cannibalization, poor snippet, missing content, slow page, broken internal link.
- Prioritize: expected impact × confidence × effort × risk; include uncertainty and alternatives.
- Prepare: draft page/title/meta/internal links/schema and implementation patch; run lint, crawl, privacy and duplicate checks.
- Approve: owner reviews live publishing, canonical/domain changes, external submissions, business profile edits, campaign spend and material legal/privacy changes.
- Verify: after authorized release, inspect status and outcomes; rollback if errors/privacy risk/crawl loss.
- Learn: update hypotheses based on real impressions/clicks/conversions; do not treat correlation as proof.

## Autonomous vs approval
**May run automatically in preproduction:** audits, link checks, sitemap validation, title/meta duplicate detection, performance reports, keyword clustering, draft suggestions, issue creation and report generation.
**Requires explicit owner approval:** DNS/domain changes, live deploy, Search Console verification token changes, sitemap submission on production, GBP edits, publication of content, canonical redirects, external posts, marketing emails, paid campaigns, or collecting new personal data.
SUPRA must never ask the user to paste passwords, private keys, OTP codes, or account recovery codes into chat. Use secure Google OAuth/authorization flow and least-privilege access if connector integration exists.

## SEO safety and integrity
- No guarantee of ranking, traffic, revenue or indexing.
- No deceptive “AI content” mass publishing; editorial review, useful original content, accurate service claims.
- No reviews created by staff/AI, purchased reviews, review gating or reward for positive review.
- Avoid unsupported health, care, safety, employment, income or legal claims.
- Do not use Google brand in a way that implies endorsement.
- Respect robots directives, rate limits, terms and privacy law.

## Launch milestones
- G0: identify/confirm canonical domain, legal entity name, target service area, actual eligible services, website owner.
- G1: technical crawl and Search Console readiness.
- G2: domain verification (owner-operated secure account), sitemap/robots validation.
- G3: public pages and mobile QA; no private content indexing.
- G4: submit sitemap/monitor indexing only after production launch approved.
- G5: monthly SEO review and incident alerts.
No G0–G4 live action is considered completed until evidence is recorded.

## KPI
- Indexed valid pages vs submitted, indexing errors, impressions/clicks/CTR/average position (directional, not guaranteed).
- Organic landing sessions (privacy compliant), qualified waitlist conversion, first booking, completed booking, repeat booking.
- Search visibility by relevant service/area, page speed, crawl errors, conversion quality and contribution margin.
- Report both wins and regressions; do not optimize rankings at the expense of accessibility, privacy, safety or profitability.
