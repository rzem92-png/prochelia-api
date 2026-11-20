# PROCHÉLIA — Contrat produit et architecture opérationnelle

> Statut : spécification candidate Preview. Ce document ne prouve ni implémentation, ni conformité juridique/comptable, ni disponibilité H24. Toute capacité doit être reliée à du code, un test, une télémétrie et une preuve d'exploitation.

## 1. Vision et promesse vérifiable

PROCHÉLIA est une plateforme de services multi-entreprises, lancée en France puis adaptée séparément à l'Algérie. Elle met en relation clients, entreprises et intervenants, organise les missions, sécurise les paiements via un PSP autorisé et fournit aux responsables un pilotage mesurable.

La différenciation recherchée repose sur : orchestration de bout en bout, qualité et sécurité des interventions, transparence du prix et du revenu intervenant, gouvernance multi-entreprises, traçabilité des décisions, continuité opérationnelle et assistance IA contrôlée. Ne jamais revendiquer « unique au monde » sans étude concurrentielle documentée.

## 2. Rôles et espaces produits

### Client
- Création de compte, identité et coordonnées vérifiées selon le risque.
- Recherche par besoin, zone, disponibilité, compétences et niveau de confiance.
- Devis détaillé avant engagement : prix, frais, taxes applicables, annulation et conditions.
- Réservation, paiement PSP, suivi des étapes, messagerie protégée et pièces utiles.
- Validation de réalisation, facture/reçu, notation, réclamation et suivi de résolution.
- Contrôle du partage d'adresse et des données personnelles selon le moment nécessaire.

### Entreprise / donneur d'ordre
- Profil légal, établissements, utilisateurs, rôles et délégations.
- Catalogue de prestations, zones, tarifs, règles de marge et disponibilité.
- Gestion des équipes, habilitations, assurances, documents et échéances.
- Affectation, planification, suivi SLA, qualité, incidents et litiges.
- Factures, dépenses, commissions, rapprochements et exports comptables.
- Tableaux de bord par établissement, activité, mission et période.

### Espace intervenant — produit de première classe
- Inscription guidée, identité, statut professionnel, compétences, expériences et justificatifs.
- Vérification explicite des diplômes/habilitations/assurances lorsqu'ils sont requis ; statuts « déclaré », « en vérification », « vérifié », « expiré », « refusé » distincts.
- Profil public minimisé, zones et rayon de déplacement, langues, matériel, préférences et limites de mission.
- Calendrier de disponibilité avec fuseau horaire, indisponibilités, prévention atomique des chevauchements et synchronisation autorisée.
- Tableau des missions : invitations, candidatures, acceptation, affectation, étapes, consignes et contacts strictement nécessaires.
- Proposition de prix/revenu net estimé avant acceptation, détail des commissions et frais, historique des missions et relevés PSP.
- Check-in/check-out sécurisé, preuve de réalisation proportionnée, photos/documents avec consentement et conservation limitée.
- Messagerie contextualisée, assistance, signalement sécurité, incident, réclamation et droit de réponse.
- Notes et évaluations contradictoires/modérées, procédure de contestation et détection anti-fraude explicable.
- Centre de formation, bonnes pratiques, renouvellement des justificatifs et progression des compétences.
- Accessibilité mobile, faible bande passante, reprise après perte réseau et notifications paramétrables.
- Aucun frais caché, aucune pénalité arbitraire, aucune promesse de revenu garanti. Les règles de statut professionnel et de rémunération sont validées pays par pays.

### Administration et direction
- Console d'exploitation, gestion des accès, supervision des flux et des incidents.
- KPI sourcés, marge par mission, coûts réels, prévisions avec hypothèses, budget et alertes.
- Gestion des réclamations, litiges, remboursements proposés, conformité, support et qualité.
- NEXUS SUPRA propose des analyses et plans d'action ; l'humain décide des opérations sensibles.

## 3. NEXUS SUPRA — modèle d'autorité

NEXUS SUPRA est un système d'assistance à la décision et d'orchestration, pas une personne morale, un dirigeant légal ni un substitut aux responsables humains.

Modes explicites :
1. OBSERVE : lecture et collecte de métriques autorisées.
2. SIMULATE : calculs et scénarios sans effet externe.
3. RECOMMEND : recommandations avec sources, confiance, limites et coûts estimés.
4. EXECUTE_SAFE : uniquement tâches réversibles, faible risque, allowlistées, avec limites et journal.
5. APPROVAL_REQUIRED : préparation d'une action, attente d'une approbation humaine contextualisée.
6. EMERGENCY_STOP : blocage des actions non essentielles et conservation des preuves.

Chaque action porte actor, tenant, rôle, objet, motif, policy_version, payload_hash, idempotency_key, timestamps, résultat et correlation_id. Les journaux sont append-only autant que possible, exportables et protégés contre l'altération. Les approbations sont liées au tenant, à l'action, à la ressource et au hash exact du payload ; toute modification invalide l'approbation.

Interdictions par défaut : virement, payout, remboursement, changement de coordonnées bancaires, déclaration fiscale, écriture comptable de clôture, signature contractuelle, décision juridique, suppression définitive, suspension irréversible d'un compte, accès à des données de santé ou sensibles, et toute action réglementée. Exiger séparation des tâches, double approbation lorsque le risque le justifie, plafonds et arrêt d'urgence.

## 4. Automatisation et disponibilité H24/7

Ne déclarer une automatisation active que si le déclencheur, le runtime, la politique, le journal, les alertes, le mécanisme de reprise et les tests sont déployés et observés.

- Déclencheurs : événements métier, files durables, planificateurs/Cron, échéances et alertes.
- Exécution : tâches idempotentes, limites de concurrence, timeouts, retry borné avec backoff, dead-letter queue et reprise opérateur.
- Résilience : health checks, budgets d'erreur, alertes, sauvegardes vérifiées, restauration testée, runbooks et astreinte humaine.
- Sécurité : least privilege, secrets gérés, rotation, validation de signature, protection replay, rate limits et cloisonnement tenant.
- Observabilité : logs structurés sans secrets/PII inutiles, métriques, traces corrélées, disponibilité mesurée et tableau de bord d'incidents.
- Transparence : afficher dernier succès, prochaine exécution, retard, état dégradé et actions humaines attendues.

Une exécution planifiée du projet ne signifie pas que le modèle IA travaille entre deux exécutions. L'IA ne doit être appelée que par un runtime effectivement déployé, avec budget, timeout, contrôle d'accès et journal.

## 5. Architecture métier et données

- Multi-tenant strict : tenant issu exclusivement de la session et des adhésions vérifiées, jamais d'un tenant arbitraire fourni par le client.
- Autorisation : RBAC + attributs de ressource, moindre privilège, séparation client/entreprise/intervenant/support/comptable/admin.
- Toutes les relations métier vérifient la cohérence tenant : mission-client, mission-intervenant, prestation-tarif, paiement-mission, document-propriétaire.
- Données personnelles minimisées, chiffrement en transit/au repos, rétention définie, export et effacement selon obligations, registre d'accès.
- Identifiants non devinables, pagination bornée, validation serveur, limites de corps, protection CSRF/XSS/SSRF et contrôle de fichiers.
- Disponibilités et réservations protégées par contraintes transactionnelles/DB et idempotence, pas seulement par pré-vérification applicative.
- États métier définis par machines à états, transitions autorisées, événements audités et compensation explicite.

## 6. Finance : deux livres séparés

### Comptabilité de l'entreprise PROCHÉLIA
Factures clients et fournisseurs, notes de frais, justificatifs, commissions acquises, charges, immobilisations si applicables, TVA, échéances, impayés, trésorerie, rapprochement bancaire, grand livre, journaux, clôtures et exports. Les montants sont issus de pièces ou de transactions vérifiables, jamais inventés. Écritures équilibrées en partie double, devise et règles d'arrondi explicites, période comptable, source, pièce, auteur, approbateur et correction par contrepassation traçable. Validation par expert-comptable selon obligations.

### Fonds et paiements de la plateforme
Le PSP est la source de vérité des mouvements de fonds. Distinguer encaissement, frais PSP, commission plateforme, montant dû au prestataire, remboursement, litige, réserve et payout. Webhooks signés sur le corps brut, tolérance temporelle, idempotence persistée, ordre d'événements géré, rapprochement PSP/ledger et alertes de divergence. Aucun stockage de données carte sensibles. Ne pas détenir/transmettre des fonds comme simple intermédiaire sans avis juridique sur le régime applicable (services de paiement, agent, cantonnement/séparation).

Mouvements réels désactivés jusqu'à recette Sandbox complète, validation juridique, vérification PSP/KYC, rapprochements et approbation humaine documentée.

## 7. Modèles pays : France puis Algérie

France : paramétrer le plan comptable et les obligations applicables avec expert-comptable, TVA, facturation, droit de la consommation, droit du travail/prestation, assurances, RGPD, DSA/AI Act si applicables, médiation, conservation et règles PSP.

Algérie : créer une matrice juridique, fiscale, comptable, devises, paiements, données, hébergement/transferts, contrats, assurances et statut des intervenants distincte, validée localement. Ne pas réutiliser automatiquement les taux, contrats, statuts ou règles françaises. Activer le pays uniquement après avis local et tests dédiés.

## 8. Sécurité et conformité — critères bloquants

- Authentification robuste, MFA des administrateurs, sessions révocables, rotation et expiration.
- Device trust par clé cryptographique, challenge signé, preuve de possession, révocation et récupération sûre ; un simple fingerprint/hash n'est pas une preuve.
- Webhooks HMAC/signature : corps brut, comparaison constante, anti-rejeu, secret rotatif, idempotence et tests de rejeu.
- Séparation environnements et secrets ; CI OIDC à privilèges minimaux ; branches protégées.
- Sauvegarde chiffrée avec clé séparée, inventaire d'objets, hash, manifeste signé, rétention et restauration isolée démontrée.
- Tests de pénétration ciblés, dépendances/SBOM, analyse de secrets, SAST/DAST, charge, chaos et réponse incident.
- DPIA si nécessaire, registre des traitements, sous-traitants, DPA, droits des personnes, violations, conservation et transferts internationaux.
- Revue juridique et sécurité des personnes pour les catégories de services à risque.

## 9. Stratégie de test et critères d'acceptation

Chaque fonctionnalité doit avoir tests unitaires, intégration, API contract, E2E par rôle, tests négatifs d'autorisation, concurrence, idempotence, charge raisonnable, accessibilité, régression et preuve de déploiement Preview.

Jeux synthétiques uniquement. Vérifier explicitement :
- tenant A ne lit/modifie jamais les objets de B, y compris par ID direct, exports, recherche, pièces jointes, cache et événements ;
- intervenant ne voit que ses offres, missions et informations financières autorisées ;
- deux disponibilités concurrentes qui se chevauchent ne peuvent pas être acceptées ;
- répétition de webhook/candidature/paiement ne crée pas de doublon ;
- signature incorrecte, replay, payload trop volumineux et rôle insuffisant sont rejetés ;
- restauration R2 isolée reproduit un état vérifiable ;
- arrêt d'urgence bloque les actions automatisées ;
- panne d'un fournisseur externe produit une dégradation contrôlée et une reprise sûre.

CI verte != recette live. Preview déployé != Production prête. Test Sandbox != autorisation de mouvement réel.

## 10. Tableau de bord de direction — indicateurs calculables

Missions demandées, devisés, acceptées, réalisées, annulées et contestées ; délai d'affectation ; taux d'acceptation ; ponctualité ; récurrence ; satisfaction ; incidents ; temps de résolution ; revenu brut, commissions, frais PSP, montant intervenant, marge contributive, coût support, impayés, remboursements, trésorerie et écarts de rapprochement.

Chaque KPI affiche formule, période, devise, périmètre tenant, source, date de fraîcheur, couverture et avertissement si données incomplètes. Les prévisions exposent hypothèses et intervalles, jamais comme certitudes.

## 11. Ordre de livraison sans doublons

1. Inventaire des fonctions existantes et cartographie des doublons ; un seul contrat API, une seule machine à états par domaine et un seul système de backup canonique.
2. Fondations tenant, IAM, session, device trust, audit et protection de branche.
3. D1 Preview : migrations vérifiées sur copie isolée, rollback/compensation documentés, tests d'isolation.
4. Worker et Pages : contrats API communs, proxy allowlist, E2E live synthétique.
5. Espace intervenant complet et sécurisé.
6. Parcours client et entreprise de bout en bout.
7. Missions, planification, disponibilité atomique, qualité et litiges.
8. Finance entreprise et ledger plateforme en simulation, puis PSP Sandbox.
9. NEXUS SUPRA observe/simule/recommande, puis allowlist d'automatisations réversibles.
10. Backup/restore, observabilité, incident, charge, sécurité, accessibilité.
11. Validation juridique/comptable France ; lancement limité France.
12. Matrice Algérie et validation locale avant activation.

## 12. Gates de mise en service

Aucun passage de gate par simple déclaration. Chaque gate exige commit SHA, environnement, exécution CI, rapport de test, preuve runtime, risques résiduels, approbateur et date.

- G0 : architecture et inventaire des doublons.
- G1 : IAM, tenant, sessions, journal et sécurité.
- G2 : données, migrations, backup et restore.
- G3 : parcours client/entreprise/intervenant E2E.
- G4 : finance en simulation et rapprochements.
- G5 : PSP Sandbox complet et revue juridique.
- G6 : observabilité, charge, incident et continuité.
- G7 : autorisation humaine de lancement limité.

Production, migrations Production, paiements réels, remboursements, payouts, déclarations et actes juridiques restent interdits à l'automatisation de ce chantier Preview.

## 13. Règle de reporting

Chaque reprise publie : SHA et branches observés, PR et checks, déploiements réels, D1/R2 réels, tests réellement exécutés, changements commités, risques rouges, domaines non vérifiés, actions humaines requises et prochaine tâche. Toute absence de preuve est marquée « non vérifié », jamais « réussi ».
