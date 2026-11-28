# PROCHÉLIA — Legal, commercial and regulatory governance matrix

**Status:** engineering control baseline; not a legal opinion or certification.
**Scope:** France, EU/EEA, international expansion and local jurisdiction profiles.
**Release rule:** no country, offer, provider, payment, campaign or regulated activity is activated until applicable compliance gates have current evidence and qualified human/legal approval where required.

## 1. Governance principles
1. Determine applicable law using service location, customer residence, provider establishment, contracting parties, activity and transaction—not headquarters alone.
2. Jurisdiction rules are versioned with effective dates, official sources, reviewer, evidence and review expiry.
3. Nexus Supra may detect, explain, recommend, request evidence, block and create remediation tasks. It cannot provide definitive legal advice, waive obligations, activate a market, or decide contested legal issues alone.
4. Unknown, expired, conflicting or incomplete evidence means FAIL CLOSED / HUMAN REVIEW.
5. Prohibit dark patterns, misleading scarcity, fabricated reviews, hidden fees, deceptive ranking, unlawful discrimination and manipulative pressure.
6. Minimize data. Segregate sensitive documents, restrict access, encrypt, limit retention and avoid sending them to general AI reasoning.
7. Contractual disclaimers cannot override mandatory law or the platform's actual conduct.
8. Explicitly assess marketplace role per flow: intermediary, agent, seller, contracting party, service provider, employer-like role, payment role, controller/processor or mixed roles.

## 2. Jurisdiction policy registry
Each profile records:
- Jurisdiction code (country plus subdivision/city where applicable), activity/service category, customer type, provider type, marketplace role and contracting parties.
- Official source URLs and source type, effective date, last verified and next review dates.
- Rule version, accountable reviewer, review status, legal approval reference, applicable controls, exceptions and evidence references.
- Known unknowns and confidence.

Never use a universal “international compliant” flag. Resolve every transaction against its specific policy profile.

## 3. France launch baseline (legal review required)

### Marketplace transparency
- Display platform identity, contact details, intermediary role, service scope and pricing model.
- Explain ranking/referencing criteria, paid placement, commercial/capital links influencing ranking, provider status and offer publication eligibility.
- Explain how intermediation works, who contracts with the consumer, who performs the service, who invoices, who receives payment and who is responsible for execution.
- Provide professional pre-contract information before offer publication/checkout; block incomplete offers.
- Explain review moderation, verification and sorting. Never claim reviews are verified without an evidenced process.
- Make legal and commercial information accessible from relevant flows, not only buried in legal pages.

### Consumer pre-contract information, price and order
Before commitment, disclose in clear language:
- Provider identity/status and required registration, qualification or authorization.
- Essential service characteristics, location, scope, exclusions, assumptions, customer prerequisites.
- Total consumer price TTC, mandatory fees, platform fee, travel/extra charges, taxes, optional add-ons and calculation method.
- Quote validity, payment timing, execution date/time, duration, cancellation conditions and renewal if any.
- Contracting party, contact/complaint route, mediator information where required, statutory rights and withdrawal information.
- Order summary, explicit payment obligation, durable contract/order confirmation.
- No preselected paid options, hidden charges, misleading price anchors, false countdowns, fake discounts or friction obstructing statutory rights.

### Checkout and contract evidence — France
Treat these as release tests, subject to service-specific legal review:
- Checkout allows the consumer to review the order, total price and entered data, and correct errors before final commitment.
- Final action clearly states the payment obligation (e.g. “commande avec obligation de paiement” or legally equivalent wording).
- Optional paid services require explicit affirmative consent; never preselect paid add-ons.
- Contract confirmation and legally required information are delivered on a durable medium and accessible for later retrieval.
- Preserve versioned order summary, price breakdown, terms shown, provider identity/status, selected options, consent/acknowledgements, timestamp and confirmation delivery evidence.
- Determine electronic contract archiving thresholds and duration from the current applicable rules; implement a legal-retention schedule rather than a universal retention period.

### Withdrawal, cancellation and refunds
- Rules must be service-category-specific: withdrawal right, statutory exceptions, early-performance request/acknowledgment, refund amount and deadline, cancellation terms.
- Capture legally required explicit consent/acknowledgments separately, timestamped, and retain evidence.
- No blanket withdrawal waiver. Use waiver only when legal conditions and form are satisfied.
- Distinguish the platform-intermediation contract from the underlying service contract.
- Edge cases, disputes and unclear rights are routed to a human reviewer.

### Provider onboarding and traceability
Collect and verify only applicable information:
- Identity, business name, contact details, registration IDs (SIREN/SIRET/RCS/RNE as applicable), VAT status, payout details through approved PSP flow and required self-certification.
- Verification against official sources; record date, source and result; recheck on expiry/change/risk trigger.
- Qualifications, insurance, licenses, permits and professional authorization for regulated service categories.
- Block publication/activation until required fields, evidence and checks are complete.
- Correction notices, suspension, appeal, reactivation and record retention procedures.
- Communicate the precise scope of checks; verification is not a blanket guarantee of every statement.

### Tax and reporting
- Assess DAC7/DPI applicability by activity, platform role, reportable sellers/providers, jurisdiction, exclusions, thresholds and data fields.
- Maintain collection, validation, due-date calendar, reporting, correction, submission evidence and notification workflow.
- VAT, invoicing, withholding, marketplace deemed-supplier/agent, income reporting and cross-border tax questions require country/activity review.
- No universal tax calculation and no filing without authorized review.

### Commercial fairness, advertising and ranking
- Label advertisements and paid placement clearly.
- Disclose ranking parameters and paid influence; do not claim neutrality falsely.
- Promotional claims must have evidence, approval, expiry and geographic scope.
- Reviews/testimonials must not be fabricated, deceptively purchased, misleadingly presented or unlawfully suppressed.
- Price/commission changes are versioned and communicated before effective date, subject to law and contract.
- Personalization, discounts and urgency cues undergo unfair-practice/dark-pattern review.

## 4. EU/EEA baseline — applicability must be assessed

### Digital Services Act (DSA)
For obligations applicable to the actual service role/size:
- Notice-and-action for alleged illegal content/services; reasoned decisions, complaints/redress and applicable transparency reporting.
- Trader traceability (Article 30) before covered traders offer to EU consumers: required identity/contact, identification, payment-account, register information and compliance self-certification; best-effort completeness/reliability assessment; block offers while required information is incomplete; correction and suspension workflow.
- Interface enables trader pre-contract disclosure obligations.
- Assess moderation, restrictions, appeals, automation and applicable human review; preserve decision rationale.
- Determine applicability, exemptions and reporting frequency from actual classification.

### Consumer and unfair commercial practices
Implement clear pre-contract disclosures, price transparency, identity/status, ranking/reviews, misleading omissions/claims, aggressive practices, dark-pattern controls and withdrawal/cancellation. EU directives are implemented nationally; country transposition and stricter local law must be tracked.

### GDPR and privacy
- Map purposes, controller/joint-controller/processor roles, lawful bases, data, recipients, retention, transfers and rights.
- Maintain privacy notices, processing records, processor agreements, subprocessor register, transfer safeguards and DPIA screening.
- Access, rectification, erasure, restriction, portability and objection workflows; proportionate identity verification.
- Consent must be granular, informed, freely given, withdrawable and not bundled where consent is required.
- Breach response, risk assessment, notification decision, evidence and deadlines.
- Minimize sensitive data; no special-category inference for ranking, pricing or eligibility without specific lawful basis and legal review.
- AI provider/model data use, retention and training must be technically and contractually verified; avoid unnecessary disclosure.

### Payments and financial regulation
- Use licensed PSP(s); do not hold, pool, transmit or safeguard funds unless approved legal structure permits.
- Distinguish authorization, capture, refund, payout, transfer, chargeback and bank-account verification.
- Assign KYC/AML/sanctions/SCA obligations to responsible entities and PSP partners.
- Nexus Supra cannot autonomously payout, refund, transfer or alter payment configuration.
- Payment architecture, split payments, escrow-like features, platform fees, reserves and cross-border flows require legal/PSP review.

### AI governance
- Inventory AI use, purpose, data, users, provider, jurisdiction, risk classification and effective dates.
- Determine AI Act applicability, prohibited practices, risk category, transparency, literacy, oversight, logging and obligations by role.
- Decision records show evidence, confidence, rule/model version, alternatives, reviewer and outcome.
- Do not solely automate legal determinations, essential-service access, disputed claims, provider suspension, refund disputes or adverse eligibility where review is required.
- AI incident register, fallback, kill switch and change control.

## 5. International and local launch gates
Before any launch:
1. Entity/branch, licensing and activity permissions.
2. Consumer, e-commerce and marketplace laws.
3. Language, accessibility and required disclosures.
4. Service-category qualifications, permits and regulated professions.
5. Contract enforceability, mandatory clauses, withdrawal, complaint and mediation.
6. Pricing, taxes, VAT/GST/sales tax, invoicing, withholding, reporting and currency.
7. PSP availability, local methods, FX and payout restrictions.
8. Privacy, localization, transfer safeguards and breach rules.
9. Worker classification, labor, social-security and platform-work requirements.
10. Insurance, liability, safety and sector regulation.
11. Advertising, rankings, reviews, competition/antitrust.
12. Sanctions, export controls and prohibited activities/territories.
13. Local dispute resolution and regulator contacts.
14. Official sources, counsel review, evidence, date and accountable owner.

Profile states: DRAFT → SOURCES_COLLECTED → LEGAL_REVIEW → CONTROL_TESTED → APPROVED_FOR_LIMITED_PILOT → ACTIVE. Expired sources, law changes, incidents or missing evidence may trigger SUSPENDED / REVIEW_REQUIRED.

## 6. Nexus Supra compliance engine
Possible states:
- PASS: current evidence and controls satisfied.
- FAIL: known breach; block and remediation.
- UNKNOWN: incomplete, stale or conflicting evidence; block/escalate.
- NOT_APPLICABLE: documented rationale and authorized reviewer.
- EXCEPTION_APPROVED: named approver, scope, expiry, compensating controls and audit reference; never silent or permanent.

Decision evidence: jurisdiction/profile version, activity, transaction context, policy ID/version, source/effective date, checks, reason codes, evidence references (not raw sensitive files), reviewer/approver, timestamp, expiry/recheck trigger and outcome.

Nexus may detect, flag, request evidence, block, create tasks, draft notices and recommend. It may not alone approve legal interpretations, activate a country, publish regulated offers, change mandatory terms, make solely automated adverse decisions, move funds, file taxes or waive rights.

Gates to implement:
- Offer publication
- Provider activation
- Consumer checkout
- Price/fee change
- Promotion/advertising
- Ranking/recommendation
- Review publication
- Contract/terms change
- Payment capture/refund/payout
- Cross-border transfer
- Complaint resolution
- Provider suspension/reactivation
- Country launch

Every gate is fail-closed if policy or evidence is unknown.

## 7. Engineering backlog

### P0 — before French pilot
- Legal entity, role and contract-flow memorandum.
- Marketplace transparency/status and ranking UX.
- Pre-contract info, total TTC pricing, quote/order evidence.
- Withdrawal/cancellation policy per service category and early-performance consent where applicable.
- Provider identity/status, registration, qualification and insurance gates.
- Complaint workflow, required mediator and escalation.
- Terms, privacy, cookies/consent, processor agreements and retention matrix.
- Security/data incident process and DPIA screening.
- Ranking, ads, reviews and dark-pattern audit.
- DAC7/DPI applicability, data collection and reporting calendar.
- PSP legal structure/payment flow; confirm no unlicensed fund handling.
- Liability, insurance, safety and accessibility review.

### P1 — before EU expansion
- DSA classification, trader traceability, notice/action, reasons, complaint/appeal and reporting.
- Country consumer law transposition matrix.
- Tax, invoice, reporting and payment matrix.
- GDPR transfer/local rules and DPIA.
- AI Act assessment and timeline.
- Worker/platform-work classification.
- Competition, advertising, reviews and ranking audit.

### P2 — each non-EU market
- Local counsel memorandum and official-source register.
- Entity/licensing, tax, payments, privacy/transfers, labor, consumer, safety, insurance and dispute resolution.
- Localized terms/notices/support.
- Limited pilot, monitoring and exit/kill switch.

## 7. Algeria launch profile — first non-EU market (legal review required)

### E-commerce provider eligibility and site requirements
Before enabling an Algeria-facing offer or checkout, determine whether PROCHÉLIA or each provider qualifies as an e-provider under Law 18-05 and which party must meet registration/site obligations. The launch gate must verify, as applicable:
- Commercial registration or artisan registration and activity scope.
- National e-provider register / CNRC verification and required domain deposit.
- Site/domain requirements (including .com.dz) and hosting requirements under the current law and implementing texts; validate current applicability with Algerian counsel and local authorities before selecting infrastructure.
- Provider identity, NIF, RC/artisan identifier, physical and electronic contact, offer/service characteristics, TTC price, availability, fees/delivery, payment, warranty/after-sales, termination, complaint, refund/return and withdrawal information where applicable.
- Electronic offer preceding the electronic contract; consumer review/correction of order details; explicit confirmation of contract; durable order/contract evidence.
- Consumer data protection, marketing consent, advertising identification and promotion terms.
- Local banking/payment-rail rules, currency controls and cross-border payment constraints. Do not assume Stripe or EU PSP flows can be used for Algerian transactions; obtain confirmation from licensed local banks/payment providers and counsel.
- Jurisdiction, contracting-party role, tax/invoicing, dispute handling, language, insurance, service qualifications and worker classification.

### Algeria release controls
- Market profile remains **BLOCKED** until a local legal memorandum confirms the platform's role, registration/domain/hosting requirements, applicable payment methods, foreign exchange, tax, data protection, consumer and service-specific rules.
- The law's electronic commerce restrictions are mapped to a service-category blocklist and human review; no automated legal interpretation may override the block.
- Store the current official law, source version, review date and evidence; review amendments and implementing texts before each release and quarterly thereafter.
- Start with a limited, monitored pilot and kill switch; no live funds or cross-border payment flow until validated.

### AI governance — current EU AI Act milestones (27 November 2026)
- AI literacy and prohibited-practice provisions have applied since 2 February 2025; general-purpose AI governance applies from 2 August 2025.
- Article 50 transparency obligations apply from 2 August 2026: disclose AI interaction when required; label/detect AI-generated or manipulated content in scope; assess deepfake and public-interest text disclosure duties.
- Certain systems already on the market before 2 August 2026 have a limited transition for Article 50(2) marking/detection until **2 December 2026**. Track this imminent deadline and assess whether PROCHÉLIA/Nexus Supra or any vendor system falls within it.
- New prohibitions regarding non-consensual intimate content and child sexual-abuse material apply from 2 December 2026.
- Annex III high-risk rules apply from 2 December 2027; Annex I regulated-product high-risk rules apply from 2 August 2028 under the amended timeline.
- Nexus Supra must maintain a system/use-case inventory, risk classification, purpose, human oversight, transparency notices, vendor/model records, evaluation, incident process, data protection assessment and change log. Screening must consider worker/platform management, access to essential services, biometric/emotion inference and any other Annex III use; no high-risk use without formal review and required controls.

## 8. Official source register — verify current consolidated law
France:
- DGCCRF platform information: https://www.economie.gouv.fr/dgccrf/laction-de-la-dgccrf/les-enquetes-et-les-controles/les-obligations-dinformation-des-plateformes-numeriques
- DGCCRF e-commerce B2C: https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/e-commerce-les-regles-entre-professionnels-et-consommateurs
- DGCCRF contract/pre-contract info: https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/le-contrat-un-accord-entre-des-parties-bien-informees-au-prealable
- Service-Public withdrawal: https://www.service-public.fr/particuliers/vosdroits/F37911
- Tax authority DAC7/DPI: https://www.impots.gouv.fr/transfert-dinformations-en-application-des-dispositifs-dpi-dac7-plateformes-deconomie-collaborative

EU:
- DSA Regulation 2022/2065: https://eur-lex.europa.eu/eli/reg/2022/2065
- Unfair Commercial Practices Directive 2005/29/EC: https://eur-lex.europa.eu/eli/dir/2005/29
- Consumer Rights Directive 2011/83/EU: https://eur-lex.europa.eu/eli/dir/2011/83
- GDPR Regulation 2016/679: https://eur-lex.europa.eu/eli/reg/2016/679
- AI Act Regulation 2024/1689 (consolidated): https://eur-lex.europa.eu/eli/reg/2024/1689
- AI Act Digital Omnibus amendment Regulation (EU) 2026/1744: https://eur-lex.europa.eu/eli/reg/2026/1744/oj
- Commission AI Act Article 50 transparency guidance: https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations
- DAC7 Directive 2021/514: https://eur-lex.europa.eu/eli/dir/2021/514

Algeria:
- Ministry of Commerce — Law 18-05: https://commerce.gov.dz/fr/reglementation/loi-n-deg-18-05
- Ministry of Posts and Telecommunications — e-commerce guidance: https://www.mpt.gov.dz/e-commerce/
- Ministry of Posts and Telecommunications — laws and ordinances: https://www.mpt.gov.dz/lois-et-ordonnances/

## 9. Acceptance and release
This matrix is an engineering baseline, not proof of compliance. Check current consolidated texts, national implementation and local rules with qualified counsel before launch. Change control and periodic source review are mandatory.

Production/public-market release remains NO-GO until applicable controls are implemented, tested, evidence is recorded, and authorized reviewers approve. This PR does not authorize deployment, remote migrations, live payments or launch.

## 10. Territory × activity coverage register (28 Nov 2026)

Machine-readable companion: `docs/compliance/territory-activity-matrix-2026-11-28.json`. It tracks 20 control categories against five activity models for each territory. **SOURCE_REGISTERED means an official reference exists in the source register only; it does not mean applicability, law, or implementation is verified.** All market flags remain false and all control implementation states remain UNVERIFIED.

| Territory | Coverage | Legal review | Market activation |
|---|---|---|---|
| France (FR) | Partial source register | Pending counsel | BLOCKED |
| EU/EEA (EU) | Partial source register; national implementation still required | Pending counsel | BLOCKED |
| Algeria (DZ) | Partial source register | Pending local counsel | BLOCKED |
| Belgium (BE) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| Switzerland (CH) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| Luxembourg (LU) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| Canada (CA) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| Morocco (MA) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| Tunisia (TN) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| Spain (ES) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| Italy (IT) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| Germany (DE) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| United Kingdom (GB) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| United States (US) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| UAE (AE) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |
| Other (OTHER) | NOT RESEARCHED | NOT RESEARCHED | BLOCKED |

Activity models tracked for every territory: service marketplace/intermediation; direct provider; B2B contract; payments/PSP/payouts; digital platform. Categories include consumer/platform rules, pre-contract, pricing/fees, cancellation/refunds, complaints/mediation, reviews/fair practices, DSA/trader traceability, DAC7/tax, privacy, retention/rights, processors/transfers, DPIA, professional qualification/insurance, PSP, security, AI governance, licensing, labor/platform work and advertising/competition.

The validator rejects missing territory/category/activity coverage, invented source references, stale review dates, `COMPLIANT` claims, or any market-activation flag. It reports metadata coverage only; qualified counsel and implementation evidence remain required.
