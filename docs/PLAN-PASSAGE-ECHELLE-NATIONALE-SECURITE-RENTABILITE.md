# PROCHÉLIA — cadre de passage à l'échelle nationale

Version de travail : 1.0 — 30 octobre 2026  
Périmètre : API, plateforme Client / Intervenant / Gérante, opérations nationales, sécurité, conformité et rentabilité.

> Ce document est un cadre d'ingénierie et de préparation. Il ne constitue ni un audit juridique, ni une certification de sécurité, ni une preuve de conformité. Les activités, contrats, assurances, obligations sociales/fiscales et qualifications doivent être validés par des professionnels compétents avant ouverture au public.

## 1. Définition de « prêt pour le national »

PROCHÉLIA ne passe pas en production nationale tant que les portes de sortie ci-dessous ne sont pas toutes documentées et approuvées. Une CI verte prouve uniquement que les contrôles automatisés exécutés ont réussi sur le commit concerné.

### Portes bloquantes
- [ ] Périmètre exact des prestations et exclusions validé par activité et territoire.
- [ ] Modèle juridique validé : rôle d'intermédiaire, responsabilités, indépendance réelle des intervenants, prévention du risque de requalification.
- [ ] Immatriculation, assurances RC professionnelle, garanties, médiation de la consommation et mentions légales vérifiées.
- [ ] Qualification des activités de services à la personne, déclaration/agrément/autorisation éventuels, règles propres aux publics fragiles et articulation avec les dispositifs fiscaux vérifiées avant toute promesse commerciale.
- [ ] Contrats B2C, B2B et intervenants revus ; prix TTC, frais, annulation, rétractation, réclamation, responsabilité et remboursement cohérents.
- [ ] PSP et flux de fonds validés contractuellement ; PROCHÉLIA ne conserve pas de fonds pour compte de tiers hors cadre réglementaire autorisé.
- [ ] RGPD : registre, bases légales, minimisation, durées, droits, sous-traitants, transferts, sécurité, procédure de violation et AIPD si nécessaire.
- [ ] Vérification d'identité, assurance, compétences et documents des intervenants avec accès restreints et dates d'expiration.
- [ ] Recette complète des trois espaces et des parcours réels, y compris échec, annulation, remboursement, litige et indisponibilité.
- [ ] Sauvegarde restaurée avec preuve, RPO/RTO approuvés et procédure de reprise testée.
- [ ] Tests de sécurité indépendants et correction des vulnérabilités critiques/hautes.
- [ ] Support, astreinte, traitement des incidents et continuité opérationnelle dimensionnés.

## 2. Sécurité — défense en profondeur

### Identité et autorisations
- MFA obligatoire pour Gérante et comptes à privilèges ; sessions courtes, révocation, rotation et protection anti-CSRF si cookies.
- RBAC côté serveur avec refus par défaut ; contrôle de propriété de chaque ressource (protection IDOR/BOLA).
- Réauthentification pour changement IBAN, identité, mot de passe, rôle, remboursement et versement.
- Séparation stricte des environnements et comptes de service à privilèges minimaux.
- Aucun secret, jeton, clé privée ou donnée personnelle dans le dépôt, les logs ou les messages d'erreur.

### API et données
- Validation stricte des schémas, tailles, types, formats, pagination et états métier ; requêtes SQL paramétrées.
- Rate limiting par IP, compte et opération sensible ; limites anti-bot et anti-énumération.
- CORS en liste blanche stricte, CSP et en-têtes de sécurité sur le front, TLS, cookies Secure/HttpOnly/SameSite.
- Idempotence des opérations financières et transitions d'état conditionnelles ; journal d'audit append-only.
- Chiffrement en transit et au repos selon les capacités des services ; rotation documentée des secrets.
- Journaux structurés sans données sensibles, horodatés, corrélables et protégés contre l'altération.
- Upload : quarantaine, limites MIME/taille, analyse antivirus, stockage privé, liens signés courts, rejet des fichiers actifs.
- Sauvegardes chiffrées, isolées, testées en restauration ; aucun test de restauration sur la base de production.

### Détection et réponse
- Alertes sur pics d'échecs de connexion, changements de rôle, remboursements, changements de coordonnées bancaires, webhooks invalides, export massif et anomalies de versement.
- Procédure d'incident : contenir, préserver les preuves, révoquer les secrets/sessions, restaurer, notifier les responsables et personnes/autorités lorsque requis, puis post-mortem.
- Objectif : vulnérabilités critiques et hautes bloquantes avant release ; aucune exception sans décision écrite, durée et mesure compensatoire.

## 3. Résilience et capacité nationale

- Tests de charge progressifs : trafic nominal, pointe, rafale, saturation, reprise après panne et dégradation d'un fournisseur.
- Budgets de latence et taux d'erreur par endpoint ; SLO de disponibilité définis après mesure réelle.
- Files/reprises idempotentes pour notifications et tâches différées ; dead-letter et outil de rejeu contrôlé.
- Circuit breakers, timeouts, retries avec backoff et jitter ; aucune boucle de retry illimitée.
- Multi-zone/région uniquement après validation de la résidence des données, des coûts, des dépendances et de la stratégie de reprise.
- Feature flags pour lancer progressivement par département/zone, catégorie et capacité d'intervenants.
- Mode dégradé explicite : empêcher une réservation si disponibilité, prix, identité, assurance ou paiement ne peuvent être confirmés.
- Plan de capacité, quotas et alertes de coûts Cloudflare, D1, stockage, e-mail/SMS, cartographie et IA.

## 4. Rentabilité mesurée — pas de croissance artificielle

Pour chaque mission, enregistrer séparément :
- prix client TTC et HT, taxes applicables ;
- rémunération intervenant et frais de déplacement ;
- commission brute, remises financées, remboursements et litiges ;
- frais PSP, coûts variables de support, SMS, cartographie et acquisition ;
- marge contributive réelle, coûts fixes alloués et résultat après charges.

Indicateurs à suivre par prestation, département, canal, cohorte et mois :
- conversion devis → réservation → mission terminée ;
- marge contributive par mission et taux de missions déficitaires ;
- coût d'acquisition client (CAC), contribution vie client (LTV) et délai de récupération ;
- coût de recrutement intervenant, activation, rétention 30/90/180 jours ;
- taux d'acceptation, annulation, absence, réclamation, remboursement et récurrence ;
- trésorerie disponible, dettes/avoirs, fonds en transit, réserve PSP et prévision de trésorerie.

Règle de pilotage : aucune promotion ou expansion locale n'est activée si la marge après coûts variables devient négative, si la capacité d'intervenants est insuffisante ou si la qualité se dégrade. Les seuils sont configurables et auditables, jamais inventés par le Copilote.

## 5. Déploiement national progressif

1. Préproduction isolée : données synthétiques, Stripe test, migrations testées et restauration.
2. Pilote sur une zone limitée : volume plafonné, support humain disponible, suivi quotidien.
3. Extension par grappes de départements : uniquement si qualité, couverture intervenants, marge et incidents restent dans les seuils.
4. Généralisation : capacité, support, assurance, conformité et supervision validés pour chaque catégorie de prestation.

Chaque release doit être traçable : commit, artefact, migrations, résultats CI, approbation, plan de retour arrière et vérification post-déploiement. Les migrations sont séparées du déploiement applicatif et réversibles ou accompagnées d'une stratégie de restauration.

## 6. Copilote transversal — garde-fous

Le Copilote peut analyser des agrégats, classer des opportunités et proposer des plans. Il ne doit jamais :
- décider seul d'un remboursement, d'un paiement, d'un changement de prix ou d'une sanction ;
- exposer des données personnelles ou de santé non nécessaires ;
- inventer une conformité, une assurance, un contrôle d'identité ou une action accomplie ;
- exécuter une action sensible sans autorisation RBAC, validation humaine et reçu technique vérifiable.

Chaque recommandation doit porter : données sources, date, hypothèses, estimation basse/haute, niveau de confiance, risque, responsable, prochaine action et preuve de réalisation. Toute donnée manquante doit être signalée comme inconnue.

## 7. Recette de bout en bout obligatoire

- Client : création compte, devis, promotion valide, réservation, paiement test, modification, annulation, remboursement, facture, réclamation, suppression/accès RGPD.
- Intervenant : candidature, vérification documentaire, activation, disponibilité, acceptation/refus, arrivée/départ, mission, rémunération, demande de versement, contestation.
- Gérante : validation, supervision, tarification, zones, capacité, support, litiges, rapprochement PSP/banque, export comptable, audit.
- Scénarios transverses : double clic, rejeu webhook, événements désordonnés, paiement réussi sans retour navigateur, remboursement partiel, versement échoué, solde insuffisant, perte réseau, DST, jour férié, compte suspendu.
- Sécurité : tests d'accès horizontal/vertical, injection, XSS, CSRF, SSRF, abus de fichiers, brute force, fuite de secrets, limites de débit et escalade de privilèges.
- Exploitation : restauration complète, rotation de secrets, rollback, panne PSP, panne e-mail/SMS et reprise.

## 8. État réel du dépôt au 30 octobre 2026

Le dépôt API contient déjà des contrôles de régression, des tests de migration SQLite, un ledger financier atomique, un contexte Copilote agrégé et des documents juridiques/de sauvegarde en préparation. Le PR de travail reste une proposition non fusionnée.

Restent notamment à prouver avant production : tests d'intrusion indépendants, tests de charge, restauration complète, intégration réelle du PSP en mode test puis validation contractuelle, recette des interfaces complètes, conformité juridique et RGPD, comptabilité/banque rapprochées, et lancement pilote supervisé.

**Décision de release : NO-GO tant qu'une porte bloquante reste non validée.**
