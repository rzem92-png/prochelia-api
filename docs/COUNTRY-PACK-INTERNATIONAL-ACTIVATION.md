# PROCHÉLIA SUPREME — Country Pack et internationalisation
Spécification de préproduction. Pays et devises désactivés par défaut.

## Country Pack
Un paquet versionné par pays/région doit définir : langues et langue contractuelle ; formats et fuseaux IANA ; devise de commande et de règlement ; taux FX horodaté, frais et arrondis ; entité opératrice et contrats ; prestations autorisées/interdites/soumises à revue ; qualifications, assurances et autorisations ; fiscalité, TVA, facturation et obligations sociales ; PSP, pays de la plateforme et des comptes connectés, KYC/KYB, flux de fonds et payouts ; RGPD/règles locales, hébergement, transferts, durées et droits ; support, partenaires, urgences et capacité ; SEO local, consentements, budgets et attribution.

## Workflow obligatoire
DRAFT → LEGAL_REVIEW → PSP_REVIEW → PRIVACY_SECURITY_REVIEW → OPERATIONS_REVIEW → QA_PASSED → APPROVED → CANARY → ACTIVE. Un échec ou une expiration peut déclencher SUSPENDED pour les nouvelles commandes. La Gérante et les experts compétents approuvent explicitement. Aucun agent IA ne peut approuver ou activer seul un pays.

## Contrats de données
Chaque devis/commande conserve un snapshot immuable du pays, de la devise, des taxes, frais, taux FX et version des règles. Les modifications sont prospectives. Toute combinaison pays/service/devise/PSP non activée est refusée par défaut.

## Paiements transfrontaliers
Aucun PSP n'est un passeport universel. Vérifier pays de la plateforme et du compte connecté, devise, nature du service, identité/statut du bénéficiaire, frais, réserves, remboursements, litiges et règles du PSP. Ne pas conserver ni transférer des fonds pour compte de tiers hors cadre autorisé.

## Déploiement
Pilote France, puis étude spécifique Belgique, Luxembourg, Suisse, puis autres marchés selon demande et autorisations. Cette séquence n'est pas une déclaration d'éligibilité. Mesurer par pays marge contributive, CAC, réachat, incidents, remboursements, coûts FX, délais de payout, capacité et conformité.
