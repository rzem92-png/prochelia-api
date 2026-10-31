# PROCHÉLIA — compliance, sécurité et gouvernance : registre de préproduction

**Statut : référentiel de travail, non-certification.** Ce document ne constitue ni un avis juridique, ni une attestation de conformité, ni une autorisation d'exploitation. Chaque exigence doit être qualifiée selon les services réellement proposés, les rôles contractuels, les pays, les données et les seuils réglementaires applicables.

## 1. Gouvernance de lancement

Aucune ouverture commerciale dans un pays tant que les contrôles applicables à ce pays ne sont pas documentés, attribués à un responsable, testés et approuvés. Une règle nationale ne doit pas être extrapolée à un autre pays.

Pour chaque exigence, conserver : juridiction, texte/référence et version, périmètre, responsable, preuve, date de test, résultat, dérogation approuvée et date de réexamen.

## 2. France et Union européenne — qualification juridique à confirmer

### Données personnelles et vie privée
- RGPD (UE) 2016/679 : rôles responsable/sous-traitant, base légale par finalité, transparence, minimisation, droits, contrats art. 28, registre, durées de conservation, sécurité art. 32, violations, transferts hors EEE et AIPD lorsque le risque l'exige.
- Loi Informatique et Libertés et doctrine CNIL : cookies/traceurs, prospection, information, sécurité et exercice des droits.
- Données sensibles : ne pas collecter de données de santé ou de vulnérabilité sans nécessité et base juridique appropriée. L'article 9 RGPD exige une exception valable. Si PROCHÉLIA héberge des données de santé pour le compte d'acteurs concernés, faire qualifier l'obligation HDS et le périmètre d'hébergement avant toute mise en service.
- Concevoir suppression, anonymisation, export, rectification, limitation et journalisation des demandes ; une sauvegarde ne doit pas réintroduire indéfiniment des données supprimées.

### Marketplace, consommateurs et fiscalité
- Code de la consommation et règles européennes applicables aux services en ligne : identité du professionnel, prix total et frais, caractéristiques, conditions d'annulation/rétractation lorsqu'applicables, médiation, réclamations, avis et information sur le classement/référencement.
- Règlement sur les services numériques (DSA) : déterminer si PROCHÉLIA est un intermédiaire, une plateforme en ligne ou relève d'exemptions ; qualifier les obligations selon la taille, le rôle et le service. Prévoir signalement, traitement des contenus/annonces illicites, transparence et points de contact lorsque requis.
- DAC7 (directive UE 2021/514) : déterminer si l'opérateur et les prestations proposées entrent dans le champ de déclaration des revenus des vendeurs/prestataires ; concevoir collecte, diligence et reporting uniquement après avis fiscal.
- TVA, facturation, archivage probant et obligations comptables françaises : validation par expert-comptable/fiscaliste avant facturation réelle.

### Prestations à domicile, travail et protection des personnes
- Qualifier précisément chaque prestation : simple assistance/entretien/accompagnement, service à la personne, activité réglementée, aide à l'autonomie ou activité de soins. Certaines activités peuvent exiger déclaration, agrément, autorisation départementale, qualification ou conditions spécifiques ; aucune prestation réglementée ne doit être publiée sans vérification.
- Le statut d'intermédiaire et le contrat de micro-entrepreneur ne suffisent pas à exclure une requalification en contrat de travail. Vérifier indépendance réelle, liberté d'organisation, absence de lien de subordination, contrôle, sanctions, exclusivité et modalités de fixation des prix.
- Vérifier assurances RC professionnelle, garanties adaptées aux missions, dommages aux biens/personnes, déplacements, accidents et responsabilités de chaque partie. Définir les procédures d'urgence, protection des personnes vulnérables, vérifications légales autorisées et limites des interventions.
- Ne pas présenter PROCHÉLIA comme service médical, de soins ou d'urgence si les autorisations et compétences nécessaires ne sont pas réunies.

### Paiements
- Utiliser un prestataire de paiement agréé pour l'encaissement, la conservation et le transfert de fonds. Faire qualifier le modèle de flux, le rôle de PROCHÉLIA, les comptes connectés, KYC/KYB, cantonnement, remboursements, litiges et versements par le PSP et un conseil spécialisé.
- PSD2 et authentification forte : vérifier les obligations applicables au parcours et au PSP.
- PCI DSS : réduire le périmètre en ne recevant, stockant ni journalisant les données carte ; utiliser les composants hébergés/tokenisés du PSP. Confirmer le périmètre avec l'acquéreur/PSP.

### Accessibilité et IA
- RGAA et obligations françaises d'accessibilité : qualifier l'assujettissement de PROCHÉLIA ; viser WCAG 2.2 AA comme cible d'ingénierie, avec audit manuel clavier, lecteur d'écran, contrastes, zoom et parcours mobile.
- Règlement européen sur l'IA (UE) 2024/1689 : cartographier les fonctions d'IA, leur finalité et les personnes affectées ; appliquer transparence, maîtrise humaine, journalisation, gouvernance et obligations d'alphabétisation IA selon le calendrier et le rôle. Ne pas utiliser le Copilote pour décider automatiquement de l'embauche, du statut, de l'accès au travail, de la rémunération, de l'éligibilité ou d'une sanction.
- Toute décision à effet juridique ou significatif doit rester soumise à une personne compétente, avec explication, contestation et piste d'audit.

## 3. Déploiement international — qualification pays par pays

Avant d'ouvrir un nouveau pays, produire une fiche locale approuvée couvrant :
- protection des données et transferts internationaux (ex. UK GDPR au Royaume-Uni ; lois locales dans chaque pays ; mécanismes de transfert et localisation) ;
- droit du travail, statut des prestataires, salaire minimum, temps de travail, protection sociale et risques de requalification ;
- règles de services à domicile, licences, agréments, vérifications et protection des personnes vulnérables ;
- droit de la consommation, langues, prix, taxes, facturation, médiation et annulation ;
- paiements, licences, KYC/KYB, sanctions et règles de transfert de fonds ;
- assurances, responsabilité civile, sécurité et exigences d'accessibilité ;
- exigences de notification d'incidents, cybersécurité et conservation des preuves.

Ne pas activer une zone géographique par simple traduction de l'interface.

## 4. Référentiels techniques de sécurité (cibles, non certifications)

- OWASP ASVS (niveau adapté au risque) et OWASP API Security Top 10 : exigences vérifiables pour authentification, autorisation, validation, sessions, rate limiting, journalisation et API.
- NIST Cybersecurity Framework 2.0 : gouvernance, identification, protection, détection, réponse et reprise.
- ISO/IEC 27001 et 27002 : système de management et contrôles ; ISO/IEC 27701 pour la gestion de la vie privée ; ISO 22301 pour continuité. Ne revendiquer aucune certification sans audit accrédité.
- SLSA / provenance des artefacts, dépendances épinglées, SBOM, analyse de vulnérabilités, secret scanning, revue de code et protection des branches.
- Cloudflare D1 : migrations versionnées, moindre privilège, sauvegardes chiffrées, restauration testée, vérification d'intégrité, séparation stricte des environnements et plan de reprise.

## 5. Contrôles techniques préproduction obligatoires

1. Schéma D1 réel comparé à la chaîne complète de migrations : tables, colonnes, types, valeurs par défaut, index, contraintes, triggers, vues, clés étrangères et historique des migrations.
2. Migration sur copie isolée de la base représentative ; contrôle avant/après et preuve de non-perte ; aucune migration destructive non revue.
3. Restauration d'une sauvegarde chiffrée vers une D1 de test vierge : intégrité SQLite, compteurs et empreintes des données non sensibles, vérification applicative et compte rendu horodaté.
4. Retrait des créations de schéma à la requête ; démarrage en échec fermé si migration manquante.
5. Tests de concurrence et idempotence pour bootstrap, missions, réservations, paiements, remboursements, litiges et virements.
6. Stripe en mode test : événements dupliqués, désordonnés, retardés, invalides, retry, remboursements partiels/concurrents, rapprochement PSP/ledger et absence de double crédit.
7. Autorisation par rôle et par ressource ; tests d'accès croisé entre clients, intervenants et gérante ; tests CSRF/XSS/SSRF/IDOR, abus de privilèges, rate limit et gestion de session.
8. Tests de bout en bout des espaces Client, Intervenant et Gérante sur iOS/Safari, Android/Chrome et ordinateur ; navigateurs pris en charge, réseau dégradé, reprise et accessibilité.
9. Observabilité : journaux structurés sans secrets/données sensibles inutiles, métriques, alertes, corrélation, détection d'anomalies et procédure d'incident.
10. Revue des contrats, assurances, mentions, politique de confidentialité, cookies, sous-traitants, durées, transferts, AIPD si nécessaire et procédures de droits.
11. Déploiement progressif en environnement isolé, smoke tests, critères d'arrêt, rollback applicatif et plan de restauration D1. Un rollback de code ne doit jamais être présenté comme un rollback de données.
12. Approbation humaine documentée de chaque contrôle et autorisation explicite distincte pour toute mise en production.

## 6. Conditions de sortie

Chaque contrôle doit avoir une preuve reproductible : commit SHA, workflow/run URL, artefact ou rapport, environnement et identifiant de base non secret, horodatage, version, résultat et approbateur.

Un workflow vert, un test statique ou une simulation ne vaut pas preuve d'exécution réelle sur D1, Stripe Sandbox ou les interfaces.

**Statut actuel : NON AUTORISÉ POUR LA PRODUCTION.** Les exigences ci-dessus sont des portes de sortie ; les contrôles non exécutés restent ouverts.
