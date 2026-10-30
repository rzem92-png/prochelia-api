# PROCHÉLIA LIFE — audit de consolidation et rentabilité

**Date de l'audit : 30 octobre 2026**  
**Périmètre :** lecture du dépôt `rzem92-png/prochelia-api`, branche `prelaunch/v14.5.7-consolidation-audit`.  
**Statut :** audit documentaire et statique du code. Aucune exécution locale des tests, aucune connexion à la base D1, aucun déploiement, aucune migration et aucun paiement réel effectués.

## 1. Éléments observés dans le dépôt

- Le dépôt est public et la branche de préproduction consultée existe.
- `wrangler.jsonc` cible `prochelia-api-staging`, une base D1 de préproduction et un bucket R2 nommé `prochelia-preview-backups`.
- Le Cron de sauvegarde déclaré est `0 3 * * *` (03:00 UTC).
- Le runbook indique explicitement que la configuration seule ne prouve pas l'exécution d'une sauvegarde ou la réussite d'une restauration.
- `package.json` déclare un script `test:prelaunch` regroupant six fichiers de tests.
- Les tests comprennent des tests de comportement pour certains helpers (notamment signature Stripe et économie de marketplace), mais plusieurs tests vérifient la présence de motifs dans le code source. Ces tests de contrat statique ne remplacent pas les tests d'intégration D1, navigateur, PSP ou tests de charge.
- `src/trust-passport.js` contient une fonction déterministe d'éligibilité qui échoue en mode fermé lorsque les preuves requises ne sont pas valides.
- `src/stripe-adapter.js` contient une vérification de signature Stripe sur le corps brut et une construction de payload Checkout.
- `src/marketplace-core.js` fournit des fonctions pures pour le rapprochement financier et les transitions d'état de commande. Ce module ne réalise ni persistance D1, ni mouvement d'argent, ni appel PSP.
- `POST /api/missions` est explicitement désactivé dans le code consulté.
- La notice RGPD et plusieurs documents juridiques sont explicitement marqués comme brouillons à compléter/valider avant publication.
- Les tentatives de lecture des chemins racine `README.md`, `LICENSE`, `NOTICE`, `SECURITY.md` et des lockfiles usuels n'ont pas abouti sur cette branche aux chemins testés. Cela doit être confirmé par un inventaire complet du dépôt avant de conclure à leur absence définitive.

## 2. Correction ciblée réalisée

Le calcul de contribution de plateforme dans `src/marketplace-core.js` vérifiait les entrées monétaires et l'allocation, mais ne contrôlait pas explicitement le dépassement de la plage entière sûre après soustraction des frais, remises et coûts variables.

Correction ajoutée :
- rejet explicite avec `PLATFORM_CONTRIBUTION_OVERFLOW` si le résultat n'est pas un entier JavaScript sûr ;
- test de régression ajouté dans `tests/marketplace-core.test.mjs`.

Cette correction protège ce helper pur contre une marge imprécise. Elle ne prouve pas que les données de marge de toute l'application sont correctes ni que les paiements réels sont réconciliés.

## 3. Limites de validation à lever

Les statuts de vérification consultés pour les commits de documentation et de correction ne renvoient aucun statut CI exploitable. Cela ne prouve ni succès ni échec : le résultat est **non vérifié**.

Avant de qualifier le socle de prêt :
1. exécuter `npm run test:prelaunch` dans un environnement Node compatible et conserver la sortie complète ;
2. ajouter/faire tourner des tests d'intégration sur une base D1 isolée, avec schéma réel ;
3. vérifier les migrations, contraintes, index, triggers et compatibilité des données déjà présentes ;
4. tester les parcours authentification, RBAC, devis, commande, paiement, webhook, remboursement, litige, versement et rapprochement avec PSP de test ;
5. vérifier la restauration complète d'une sauvegarde dans une base D1 temporaire isolée, puis la réapplication des suppressions RGPD postérieures à la sauvegarde ;
6. faire des tests de sécurité et de charge, avec preuves et seuils de réussite ;
7. tester séparément les interfaces Client, Intervenant et Gérante, les notifications et les services tiers.

## 4. Points financiers bloquants avant lancement commercial

- Définir contractuellement et comptablement qui vend, facture, encaisse, rembourse et supporte chaque risque, pour chaque catégorie.
- Distinguer GMV, chiffre d'affaires comptable, commissions acquises, fonds de tiers, taxes et trésorerie disponible.
- Réconcilier chaque transaction avec les événements PSP, les frais PSP, les remboursements, les litiges, les versements et le grand livre interne.
- Démontrer l'idempotence des webhooks et la reprise après interruption.
- Calculer la marge contributive réelle par activité, catégorie, territoire et canal, après coûts variables, support, fraude, remboursements et remises financées par la plateforme.
- Établir le seuil de rentabilité, le budget glissant et les scénarios prudent/central/favorable.
- Vérifier que les commissions et frais sont affichés avant engagement et que les montants dus aux professionnels ne sont jamais utilisés comme trésorerie de la plateforme.

## 5. Points de gouvernance et de protection à fermer

- Inventaire complet des fichiers, auteurs/contributeurs, commits, contrats, licences et origine de chaque composant.
- Vérification des droits sur le code produit dans le cadre d'emplois, missions, prestations ou contributions externes.
- Inventaire des dépendances et licences open source, y compris composants embarqués et services tiers.
- Politique de divulgation des vulnérabilités, responsable de sécurité et coordonnées de contact à publier.
- Registre des traitements, sous-traitants, transferts, durées, consentements et procédures d'exercice des droits.
- Revue juridique des activités et des rôles réels de la plateforme ; les mentions « intermédiaire » ne suffisent pas à elles seules.
- Gouvernance Copilot : droits par rôle, journalisation, limites de dépenses, approbation humaine, mécanismes d'arrêt et interdiction d'exécuter directement une sortie de modèle.

## 6. Conditions de passage au pilote

Un pilote limité peut être envisagé seulement lorsque les tests techniques, la sécurité, les documents contractuels, la protection des données, les assurances, le PSP et les procédures de support sont validés pour la catégorie et le territoire concernés.

**Décision actuelle : PRÉPRODUCTION / AUDIT EN COURS. Pas de feu vert pour production ou ouverture commerciale générale.**


---

## 7. Audit complémentaire des remboursements PSP génériques

Une revue statique du traitement `payment_refunded` a identifié un défaut de classification : un remboursement partiel pouvait faire passer la transaction directement à l'état `refunded`, alors que le montant remboursé restait inférieur au montant brut.

Corrections ajoutées sur la branche de préproduction :
- l'état est maintenant calculé à partir du cumul remboursé : `partially_refunded` tant que le remboursement cumulé est inférieur au montant brut, puis `refunded` lorsque le total atteint le montant brut ;
- la réconciliation d'un remboursement reçu avant la confirmation du paiement calcule également la reprise proportionnelle du montant crédité au portefeuille ;
- les tests de contrat statique ont été complétés pour couvrir la distinction remboursement partiel/complet, l'ordre d'arrivée des événements et la présence du portefeuille avant déclenchement du crédit par le ledger.

Ces changements n'ont pas été exécutés contre une vraie base D1 ou un PSP de test. Il reste à démontrer, avec des événements signés de test et des scénarios concurrents, que les soldes sont exacts dans tous les ordres d'événements.


---

## 8. Registre de lancement juridique et opérationnel — France d'abord

**Statut :** cadre de contrôle produit à faire valider par avocat, expert-comptable, DPO/conseil RGPD, assureur et prestataire de paiement. Cette section ne constitue ni un avis juridique ni une validation réglementaire.

### 8.1 Modèle d'intermédiation à matérialiser dans les faits

- PROCHÉLIA fournit une interface de mise en relation, de présentation des offres, de transmission des demandes et d'outils de suivi.
- Le professionnel garde la maîtrise réelle de son activité : offre, prix, capacité, disponibilité et acceptation/refus, sous réserve des règles applicables à son statut et à son secteur.
- Le client choisit le professionnel et accepte les conditions de la prestation ou de la vente avant tout paiement.
- Lorsque le modèle retenu le prévoit, la relation de vente/prestation est directement conclue entre client et professionnel. PROCHÉLIA conserve ses propres conditions d'utilisation et ses obligations propres de plateforme.
- Les écrans, factures, reçus, parcours de paiement, messages de support et pratiques commerciales doivent être cohérents avec ce rôle. Une mention « simple intermédiaire » ne neutralise pas une activité réelle de vendeur, prestataire, employeur ou mandataire si les faits conduisent à cette qualification.
- Avant activation d'une catégorie, déterminer par écrit qui est vendeur/prestataire, qui facture, qui encaisse, qui rembourse, qui traite les réclamations et qui supporte chaque risque.

### 8.2 Garde-fous contre la direction effective du travail

Le produit ne doit pas, par défaut :
- imposer des horaires ou une disponibilité permanente au professionnel indépendant ;
- imposer l'exclusivité, une acceptation minimale de missions ou une pénalité pour refus ;
- fixer unilatéralement ses prix ou modifier sa rémunération après acceptation ;
- sanctionner automatiquement une absence, un refus ou une indisponibilité sans examen humain et contradictoire ;
- laisser le Copilote attribuer une mission, modifier les conditions convenues ou suspendre un compte sur la seule base d'un score automatisé.

Le classement doit expliquer les critères utiles, éviter les pénalités liées au refus et permettre une contestation. Ces garde-fous réduisent certains risques mais ne garantissent pas à eux seuls l'absence de requalification.

### 8.3 Matrice d'activation par activité

Chaque couple pays × catégorie doit porter un état serveur parmi DRAFT, REVIEW_REQUIRED, APPROVED_FOR_PILOT, ACTIVE, SUSPENDED. En l'absence de décision documentée, l'activité reste bloquée.

- **Services du domicile et accompagnement :** vérifier le périmètre exact des tâches, les autorisations/agréments éventuels, les qualifications, les assurances, la protection des personnes vulnérables, les procédures d'urgence et les limites explicites des actes autorisés. Les soins, actes médicaux et actes réglementés ne sont pas assimilés à de simples services de confort.
- **Artisanat et travaux :** vérifier qualification lorsque requise, assurance responsabilité civile professionnelle et décennale le cas échéant, obligations d'information, devis, médiation et garanties.
- **Alimentaire et marché local :** vérifier hygiène, allergènes, traçabilité, conservation, transport, étiquetage, immatriculation et autorisations selon les produits et le mode de vente.
- **Talents et LIVE :** vérifier droits sur les images, musiques et contenus, transparence des partenariats commerciaux, protection des mineurs et règles de vente à distance.
- **B2B :** définir séparément le donneur d'ordre, le prestataire, les modalités de facturation, les responsabilités et les conditions de sous-traitance.

Aucune catégorie réglementée ou sensible ne doit être activée par simple ajout d'une ligne de catalogue.

### 8.4 Paiements, commissions et fonds de tiers

- Confirmer avec le PSP et le conseil comptable le rôle exact de chaque partie, le schéma marketplace autorisé, le bénéficiaire des fonds, les modalités de cantonnement/segregation applicables et les responsabilités KYC/KYB.
- Ne pas conserver ni utiliser les fonds dus aux professionnels comme trésorerie de PROCHÉLIA.
- Afficher avant engagement le prix total client, les frais, taxes applicables, commission, règles d'annulation et montant net professionnel.
- Conserver une piste de rapprochement entre commande, devis versionné, paiement PSP, frais, remboursement, litige, versement et écritures internes.
- Toute action de remboursement, versement, modification de commission ou écriture corrective exige une autorisation appropriée et une preuve PSP ; le Copilote peut préparer et expliquer, pas décider seul.

### 8.5 Protection des données et preuve

Avant pilote : cartographier les finalités et bases légales, minimiser les données, séparer les rôles responsable/sous-traitant selon les traitements réels, conclure les accords requis, fixer les durées de conservation, organiser les droits, les incidents et les transferts hors EEE. Ne pas utiliser des données sensibles ou des données de santé pour le matching généraliste. Les journaux d'audit doivent être proportionnés, protégés contre l'altération et soumis à une durée de conservation définie.

### 8.6 Dossier documentaire minimum avant pilote

- Conditions d'utilisation de la plateforme et règles de publication/modération.
- Conditions applicables aux professionnels et conditions de vente/prestation directement acceptées entre les parties concernées.
- Informations précontractuelles client, prix total, identité du professionnel, classement, annulation, rétractation lorsqu'elle s'applique, garanties et médiation.
- Politique de confidentialité, registre des traitements, contrats de sous-traitance, politique de conservation et procédure de violation de données.
- Politique de vérification des professionnels, pièces attendues par activité, renouvellement/expiration et recours.
- Politique de commissions, remboursements, litiges, chargebacks, versements et rapprochement.
- Assurances de la plateforme et exigences d'assurance des professionnels par métier.
- Procédure de réclamation, signalement, modération, sécurité des personnes et escalade juridique.
- Registre des licences open source, propriété intellectuelle, auteurs/contributeurs, contrats et droits d'exploitation.

Tous ces documents doivent être adaptés aux parcours réellement développés et approuvés par les professionnels compétents avant publication.

### 8.7 Conditions de passage de la préproduction au pilote France

Le statut ne passe à PILOT_READY que si les preuves suivantes sont réunies :
1. avis écrit sur la qualification d'intermédiaire et le modèle de contractualisation/paiement ;
2. revue droit du travail et autonomie effective des professionnels ;
3. validation des documents consommateurs et professionnels ;
4. validation RGPD, sécurité, conservation et sous-traitants ;
5. validation du PSP et des flux financiers réels en environnement de test ;
6. assurances et autorisations vérifiées pour la première catégorie ;
7. tests automatisés, D1 isolée, interfaces Client/Professionnel/Gérante et restauration validés ;
8. procédure de support, incident, remboursement, litige et arrêt d'urgence testée.

L'expansion européenne ou internationale exige une nouvelle validation pays par pays : droit du travail, consommation, fiscalité/TVA, obligations déclaratives des plateformes, paiements, assurance, licences sectorielles, protection des données et support local. Une traduction ou une activation technique ne vaut jamais autorisation de commercialiser.

**Décision conservée :** préproduction uniquement. La correction de politique Copilote ajoutée à cette branche est une protection technique ciblée ; elle ne constitue pas une validation juridique globale ni une autorisation d'ouverture commerciale.
