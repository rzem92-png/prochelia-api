# SUPRA — matrice de contrôles avant toute activation

## Objet et portée
Ce document complète l'architecture SUPRA V2. Il fixe les preuves minimales à obtenir avant de faire évoluer une capacité de lecture seule vers la préparation, puis vers une exécution contrôlée. Il ne constitue ni une autorisation de déploiement ni une validation juridique.

## Invariants non négociables
1. Le planificateur n'exécute aucune mutation : `executionAllowed` reste faux tant qu'un adaptateur serveur dédié n'a pas été implémenté et testé.
2. Les valeurs de contexte reçues du navigateur ne sont jamais des preuves d'autorisation. Identité, propriété, consentement, disponibilité, statut PSP et éligibilité sont relus côté serveur depuis leurs sources de référence.
3. Une action financière, contractuelle, tarifaire, RH, juridique, liée aux données personnelles ou à une mission nécessite une approbation explicite de la Gérante, attachée à une empreinte du plan et à sa version.
4. Une approbation est liée à une action précise, une ressource précise, un montant/plafond éventuel, une expiration et un acteur authentifié. Toute modification du plan invalide l'approbation.
5. Aucun statut `COMPLETED` n'est émis sans reçu d'exécution vérifié provenant de l'adaptateur métier.
6. Toute mutation est idempotente, journalisée, corrélée et réconciliable. Les reprises ne doivent pas dupliquer paiement, remboursement, notification ou affectation.
7. Les urgences humaines et professionnelles contournent la file ordinaire et déclenchent une escalade adaptée. L'IA ne remplace pas les secours, professionnels de santé ou juristes.
8. Les marchés internationaux restent désactivés tant que le dossier local n'est pas complet et approuvé.

## Matrice des classes d'action

| Classe | Exemples | Autonomie autorisée | Preuve minimale |
|---|---|---|---|
| Lecture seule faible impact | synthèse, indicateur, contrôle sauvegarde | Automatique après tests | rôle, périmètre de données, fraîcheur et provenance |
| Préparation sans effet externe | brouillon, scénario, tâche interne | Automatique, non publié | journal de génération et hypothèses |
| Communication externe | email, SMS, campagne | Préparer seulement | consentement, canal, destinataire, modèle approuvé, fenêtre d'envoi |
| Mission et intervenant | affecter, remplacer, reporter, suspendre | Proposition seulement | mission relue, propriété, compétence, disponibilité, règles contractuelles |
| Prix et promotion | tarif, remise, activation | Proposition seulement | tarif canonique, version, dates, budget, marge, validation |
| Finance et PSP | charge, remboursement, transfert, payout | Proposition seulement | événement PSP signé, ledger rapproché, montant, devise, idempotence |
| Données personnelles | export, rectification, suppression | Préparer et contrôler | identité vérifiée, périmètre, base légale, conservation, double contrôle si nécessaire |
| Juridique / RH / sécurité | contrat, résiliation, recrutement, fraude | Escalade / validation qualifiée | dossier sourcé et avis compétent |
| Urgence | danger, violence, urgence médicale, maltraitance suspectée | Escalade humaine immédiate | signal horodaté, consignes d'urgence et traçabilité |

## Contrat d'approbation et d'exécution à implémenter
- `plan_id`, `plan_version`, `plan_hash`, `action_type`, `resource_type`, `resource_id`.
- `requested_by`, `approved_by`, rôle et session valides, horodatage et expiration.
- Montant maximal, devise, tarif/version ou paramètres autorisés lorsque pertinents.
- `idempotency_key`, `correlation_id`, `adapter_name`, version de l'adaptateur.
- Reçu externe vérifié, état final, résultat de rapprochement et référence d'audit.
- Une approbation ne peut pas être réutilisée pour une autre ressource, un autre montant ou une version modifiée.

## Tests de sécurité et de fiabilité obligatoires
- Escalade sur synonymes, accents, fautes courantes et formulation indirecte des urgences.
- Matrice complète des rôles, permissions, propriété des objets et accès aux fichiers.
- Rejeu, concurrence, double clic, timeout après succès PSP, webhook dupliqué ou désordonné.
- Injection de consignes dans descriptions, pièces jointes, commentaires et contenus tiers : ces contenus restent des données non fiables.
- Données manquantes, périmées, contradictoires, falsifiées ou fournies par le client.
- Défaillance d'adaptateur, DLQ, reprise, compensation, réconciliation et statut non terminal.
- Tests de charge, limites de coût IA, quotas, rate limits et protection contre les boucles d'orchestration.
- Vérification des journaux : aucune pièce d'identité, donnée bancaire, donnée de santé ou secret ne doit être exposé dans les traces générales.

## Portes de maturité propres à chaque capacité
- **G1 Conçue** : contrat, propriétaire, risques, source de vérité et critères d'acceptation documentés.
- **G2 Implémentée** : code versionné, feature flag fermé par défaut, aucune clé de production dans le code.
- **G3 Testée** : tests unitaires, adversariaux, négatifs, limites et non-régression.
- **G4 Intégrée** : contrats API/D1/PSP simulés, RBAC et propriété vérifiés.
- **G5 Préproduction** : parcours E2E sandbox, preuves, restauration et supervision testés.
- **G6 Autorisée** : revue indépendante sécurité/conformité, validation de la Gérante, plan de retour arrière.
- **G7 Exploitée** : activation progressive, alertes, SLO, audit, astreinte et arrêt d'urgence vérifiés.

Une capacité ne peut pas hériter du niveau d'une autre. Chaque domaine et chaque adaptateur possède son propre statut de maturité.

## État actuel
Les modules d'orchestration et de gouvernance préparent des plans. Les adaptateurs réels, les tests E2E de tous les domaines et la validation des interfaces restent des travaux distincts. Le statut de cette branche demeure développement/préproduction non autorisée. Aucun merge, migration D1 ou déploiement de production n'est demandé par ce document.
