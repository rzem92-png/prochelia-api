-- PROCHÉLIA — commercial and recruitment schema v1
-- Additive/idempotent. Extracted from ensureCommercialRecruitmentSchema.
-- Reconcile environment baselines before applying; no request-time DDL.

CREATE TABLE IF NOT EXISTS commercial_prospects (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'B2B', company_name TEXT, contact_name TEXT,
      email TEXT, phone TEXT, website TEXT, sector TEXT, city TEXT, postal_code TEXT,
      source TEXT, need TEXT, estimated_potential_cents INTEGER, score INTEGER NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'QUALIFICATION', status TEXT NOT NULL DEFAULT 'OPEN',
      next_action TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_commercial_prospects_priority ON commercial_prospects(status,score DESC,updated_at);

CREATE TABLE IF NOT EXISTS commercial_playbooks (
      id TEXT PRIMARY KEY, target_type TEXT NOT NULL, stage TEXT NOT NULL,
      objective TEXT NOT NULL, script TEXT NOT NULL, objections_json TEXT NOT NULL DEFAULT '[]',
      followup_json TEXT NOT NULL DEFAULT '[]', metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS recruitment_candidates (
      id TEXT PRIMARY KEY, full_name TEXT, email TEXT, phone TEXT, metier_code TEXT,
      city TEXT, radius_km REAL, qualifications_json TEXT NOT NULL DEFAULT '[]',
      documents_status TEXT NOT NULL DEFAULT 'TO_VERIFY', identity_status TEXT NOT NULL DEFAULT 'TO_VERIFY',
      score INTEGER NOT NULL DEFAULT 0, stage TEXT NOT NULL DEFAULT 'SOURCING',
      status TEXT NOT NULL DEFAULT 'OPEN', notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_recruitment_candidates ON recruitment_candidates(status,score DESC,updated_at);

CREATE TABLE IF NOT EXISTS copilot_growth_actions (
      id TEXT PRIMARY KEY, category TEXT NOT NULL, target_type TEXT NOT NULL, title TEXT NOT NULL,
      recommendation TEXT NOT NULL, expected_impact_json TEXT NOT NULL DEFAULT '{}',
      priority INTEGER NOT NULL DEFAULT 10, status TEXT NOT NULL DEFAULT 'PROPOSED',
      approved_by TEXT, executed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS sales_results (
      id TEXT PRIMARY KEY, prospect_id TEXT, stage TEXT NOT NULL, outcome TEXT NOT NULL,
      amount_cents INTEGER, margin_cents INTEGER, source TEXT, notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

Bonjour, je reviens vers vous concernant PROCHÉLIA. Je reste disponible pour voir si notre solution peut répondre à vos besoins ${t==='INTERVENANT'?'de missions et d’activité':'d’intervention'}.;

Bonjour ${name}, je vous contacte au nom de PROCHÉLIA. Nous proposons une solution organisée pour ${need}. L’objectif est de vous faire gagner du temps et de disposer d’une solution souple lorsque vous avez besoin d’interventions fiables et structurées. Seriez-vous disponible pour un échange de 10 minutes afin de voir si cela peut être utile à ${org} ?;

Merci pour votre intérêt. Avant de vous présenter PROCHÉLIA en détail, j’aimerais comprendre ${need}. Quels sont aujourd’hui vos principaux besoins, vos contraintes de délai et votre fréquence d’intervention ?;

PROCHÉLIA accompagne ${target==='INTERVENANT'?'les intervenants dans le développement et l’organisation de leur activité':target==='B2C'?'les particuliers dans leurs besoins d’intervention':'les entreprises dans l’organisation de leurs besoins d’intervention'}. La plateforme centralise les demandes, la mise en relation, le suivi et la traçabilité afin de simplifier le parcours.;

Bonjour ${name}, je reviens vers vous au sujet de PROCHÉLIA. Je voulais simplement vérifier si ${need} est toujours d’actualité. Si oui, je peux vous proposer une solution adaptée sans vous faire perdre de temps.;

Au regard de votre besoin, je vous propose que nous validions la prochaine étape : un premier échange, une première mission ou une proposition adaptée à votre volume. L’objectif est de commencer simplement et de mesurer les résultats.;

Pour ${org}, je recommande de mettre en avant ${benefits.slice(0,3).join(', ')}. ${g.objective}.;

Quel est votre besoin principal aujourd’hui ?;

À quelle fréquence ce besoin se présente-t-il ?;

Quelles sont vos principales contraintes (délai, zone, budget, disponibilité) ?;

Qu’est-ce qui ferait qu’une solution serait réellement utile pour vous ?;
