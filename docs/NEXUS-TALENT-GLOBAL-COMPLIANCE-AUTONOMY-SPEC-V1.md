# PROCHÉLIA — Nexus Talent, conformité pays et autonomie SUPRA (V1)

Date: 20 novembre 2026  
Statut: spécification produit et sécurité — **pas une certification juridique ni une preuve de fonctionnalités déployées**.

## 1. Décision produit

Nexus Talent est un domaine natif de PROCHÉLIA, complémentaire au marché de services. Il permet aux personnes majeures, créateurs, artisans, indépendants, TPE/PME et grandes entreprises de présenter leurs savoir-faire, développer une audience et commercialiser des offres autorisées.

Signature proposée : **du talent à l'activité**. Pas de dépendance exclusive à un algorithme, aux vues ou aux cadeaux virtuels. Chaque profil peut disposer d'une vitrine, d'outils de publication, d'événements, de lives, de réservations, d'offres, d'analyses et d'un espace de gestion des revenus.

L'accès spectateur gratuit doit rester possible. Les paiements sont facultatifs et clairement annoncés : soutien volontaire si légalement permis, achat de contenu, réservation d'atelier, billet d'événement, abonnement ou commande. Aucun paiement ne doit être présenté comme nécessaire pour accéder à une fonction gratuite.

## 2. Périmètre global à préserver

Cette spécification ne remplace aucune brique de PROCHÉLIA. Le produit complet conserve :
- marketplace de services : demandes, devis, missions, réservation, exécution, preuve de réalisation, réclamation et résolution ;
- comptes clients, intervenants, entreprises et gestionnaires avec permissions séparées ;
- Nexus Talent : profils, découverte, recommandations explicables, publication, live, événements et outils de croissance ;
- espaces de travail et tableaux de bord pour clients, intervenants, créateurs et entreprises ;
- tarification, contrats, facturation, paiements, remboursements, litiges et rapprochement comptable ;
- Nexus Supra : gouvernance, assistance, détection de risques, orchestration autorisée et supervision ;
- sécurité, conformité, accessibilité, support, observabilité, sauvegardes et reprise ;
- déploiement multi-pays avec configuration et validations locales.

## 3. Outils de l'espace créateur / intervenant

Chaque titulaire éligible doit pouvoir accéder, selon son statut et son pays, à :
- profil professionnel/personnel public contrôlé, portfolio, compétences, catalogue et liens ;
- calendrier, disponibilité, réservation, gestion des participants et listes d'attente ;
- studio live avec modération, signalement, blocage, règles de chat, consentement d'enregistrement et contrôle des droits ;
- billetterie et accès payant facultatif, contenus à la demande, ateliers et rendez-vous ;
- page d'offres, devis/commandes, coupons et offres groupées lorsque permis ;
- statistiques compréhensibles : portée, conversion, ventes, remboursements, frais, net à recevoir ;
- centre de revenus : solde disponible/en attente, échéances estimées, justificatifs, factures et historique ;
- gestion de communauté, messages encadrés, avis vérifiés et outils anti-harcèlement ;
- assistant de développement : calendrier éditorial, recommandations de prix, diagnostic de visibilité et plan d'action ;
- export des données, paramètres de confidentialité, fermeture et procédures de contestation.

Ne jamais promettre une rémunération garantie, une audience garantie ou un paiement instantané. Le délai cible de versement (par exemple 24/48 h) n'est affiché que si le PSP, les contrôles KYC/KYB/AML, les délais bancaires, les réserves et le droit local le permettent effectivement.

## 4. Modèle économique équitable

Le moteur de revenus doit comparer plusieurs sources et afficher avant validation : prix payé par l'acheteur, taxes applicables et redevable, frais PSP, commission PROCHÉLIA, retenues/réserves autorisées, montant net estimé et date estimée de disponibilité des fonds.

Règles impératives :
1. pas de frais cachés ni de modification rétroactive ;
2. consentement explicite avant achat, abonnement ou renouvellement ;
3. annulation, remboursement et rétractation selon la catégorie d'offre et le pays ;
4. aucun portefeuille ou conservation de fonds par PROCHÉLIA sans analyse réglementaire et autorisation requise ;
5. flux financiers exécutés par un PSP autorisé dans le pays concerné ;
6. ledger serveur append-only, idempotence, rapprochement, piste d'audit et séparation des fonds ;
7. pas de paiement réel avant tests sandbox E2E, validation contractuelle PSP et revue financière/juridique ;
8. lutte contre fraude, blanchiment, usurpation, transactions fictives et abus des remboursements, avec revue humaine et recours.

## 5. NEXUS SUPRA — rôle exécutif et limites d'autonomie

SUPRA est un orchestrateur et assistant de décision, non une autorité juridique, bancaire ou administrative. Le fonctionnement H24/7j est un objectif d'architecture exigeant infrastructure, supervision, astreinte, alertes, budgets, reprise et tests de disponibilité.

SUPRA peut automatiquement, dans des politiques versionnées et autorisées : surveiller disponibilité/erreurs/fraude/anomalies ; classer les incidents et notifier ; recommander prix, commissions et offres à partir de données licites avec explication et limites ; assister la découverte, la création et la planification ; suspendre temporairement une action à risque selon des règles préétablies, avec notification et recours ; déclencher des contrôles techniques réversibles et des procédures de reprise testées.

SUPRA ne peut pas sans validation humaine habilitée : donner un avis juridique définitif ou déclarer la conformité acquise ; modifier un contrat, une commission, une politique de remboursement ou une règle pays avec effet rétroactif ; transférer des fonds, modifier des coordonnées bancaires, payer ou rembourser hors règles PSP préapprouvées ; prendre une décision définitive de bannissement, de fraude ou d'éligibilité contestée ; publier une allégation non vérifiée ; déployer en production, appliquer une migration destructive ou supprimer des données ; accéder aux pièces d'identité ou données sensibles au-delà du strict besoin.

Toute action SUPRA doit avoir identité de l'agent, rôle, motif, source, politique/version, niveau de confiance, impact, journal append-only, identifiant de corrélation et mécanisme de contestation. Prévoir arrêt d'urgence, limites de dépenses, quotas, permissions minimales, double validation pour opérations critiques et retour arrière.

## 6. Protection des mineurs et parcours « Jeunes Talents »

PROCHÉLIA doit pouvoir accueillir un parcours Jeunes Talents distinct du marché professionnel adulte, mais uniquement dans les pays et catégories où une analyse juridique locale a confirmé les conditions de participation. Ce parcours n'est jamais activé par défaut. Il ne donne pas automatiquement accès aux missions de services, au travail indépendant, aux contrats professionnels, aux lives publics ni aux paiements.

- Parcours séparé par tranche d'âge et pays, avec âge vérifié par un prestataire proportionné; ne pas se fier à une date de naissance déclarée. Conserver un jeton/attribut d'âge plutôt que la copie d'une pièce lorsque possible.
- Consentement et implication du titulaire de l'autorité parentale lorsque le droit l'exige; vérification proportionnée du lien et procédure de retrait. Ne pas demander plus de données familiales que nécessaire.
- Profil privé par défaut, pseudonyme public, aucune adresse/école/localisation précise, aucune géolocalisation en direct, aucune indexation externe par défaut et aucune publicité comportementale ciblée.
- Messagerie privée adulte-mineur désactivée par défaut; aucun contact privé non sollicité, aucun partage de coordonnées, aucune rencontre hors plateforme sans procédure et encadrement légal spécifiques.
- Commentaires, lives, cadeaux, contenus sponsorisés et interactions soumis à des restrictions adaptées à l'âge; modération renforcée, filtres de contact, blocage immédiat et signalement accessible.
- Pas de mécanismes de pression, de classement humiliant, de récompenses aléatoires payantes, de compte à rebours manipulatoire ni de sollicitation financière directe.
- Aucun versement direct à un mineur par défaut. Toute rémunération éventuelle doit être désactivée jusqu'à validation écrite du droit local, du statut, des règles de travail des enfants, de la fiscalité, des contrats, du PSP et du rôle du représentant légal. Si un modèle autorisé existe, le bénéficiaire, le compte de paiement et les justificatifs doivent être définis conformément au droit applicable; l'accord parental seul ne suffit pas à rendre une activité licite.
- Les adultes et les mineurs ne partagent pas les mêmes règles d'accès, de découverte, de recommandation, de monétisation et de contact. Les décisions d'éligibilité ou de sanction sont explicables et contestables.
- Si l'âge est incertain, si le contrôle échoue ou si le pays n'est pas validé, le compte reste en mode restreint sans publication publique, contact ni monétisation. Prévoir recours humain.
- Les signalements de mise en danger, grooming, exploitation, sextorsion ou contenu sexuel impliquant un mineur suivent une procédure urgente dédiée, avec conservation minimale et sécurisée des éléments, escalade vers les personnes compétentes et signalement aux autorités lorsque requis. Ne jamais demander à l'utilisateur de renvoyer ou télécharger un contenu sexuel impliquant un mineur.

La vérification d'âge, l'identité, le statut professionnel, les qualifications et le KYC/AML sont des contrôles distincts. Aucun mineur n'est utilisé comme main-d'œuvre sur le marché des missions tant que le cadre légal applicable n'a pas été qualifié et autorisé.

## 7. Conformité par pays — France, UE, Algérie et extensions

Aucun lancement transfrontalier sur la seule base d'un socle juridique français. Chaque pays doit avoir une fiche de conformité versionnée, validée par un conseil local, couvrant au minimum : qualification des rôles ; immatriculation/licences/professions réglementées ; contrats et consommation ; fiscalité/facturation ; paiements, monnaie, change, transferts, PSP, KYC/KYB/AML et sanctions ; données personnelles et transferts internationaux ; propriété intellectuelle et droits musicaux/audiovisuels ; publicité, sponsoring et influence ; modération, signalement et recours ; droit du travail et risque de requalification ; accessibilité, cybersécurité, assurance et notification d'incidents.

### France et Union européenne

La matrice devra examiner, selon les rôles et seuils réellement applicables : RGPD et loi Informatique et Libertés, DSA, règlement IA (AI Act), droit de la consommation, droit commercial, fiscalité, règles de paiement et DSP2/évolutions applicables, DAC7 si le modèle entre dans son champ, droit d'auteur et droit social. Ne pas présumer que toutes les obligations applicables aux très grandes plateformes s'appliquent à PROCHÉLIA ; classifier le service et son audience.

### Algérie

Avant toute commercialisation ou paiement en Algérie, obtenir une analyse locale écrite portant notamment sur le commerce électronique et la protection du consommateur, l'identification et l'immatriculation des opérateurs, la protection des données personnelles et les formalités auprès de l'autorité compétente, les paiements électroniques et prestataires autorisés, la réglementation des changes et transferts, la fiscalité/facturation, la publicité, la propriété intellectuelle, les contenus et les règles sectorielles. Ne pas supposer qu'un PSP européen, un compte en devise ou un paiement transfrontalier est autorisé. Flux, devise, contrats et entité contractante doivent être validés localement.

Chaque fiche pays comporte : statut (bloqué/en revue/validé), date, textes et sources officielles, avis du conseil local, responsable, fonctionnalités permises/interdites, PSP autorisés, modèles contractuels, règles de données et date de réexamen. Si un point critique n'est pas validé, le pays ou la fonctionnalité reste désactivé.

## 8. Protection de PROCHÉLIA et répartition des responsabilités

La plateforme ne peut pas s'exonérer globalement de ses responsabilités par ses CGU. Définir les rôles et obligations réels, rédiger des contrats cohérents avec les parcours, assurer la traçabilité des consentements, modérer de façon proportionnée, répondre aux signalements et conserver les preuves nécessaires.

Prévoir CGU distinctes par catégorie de compte et pays ; contrats créateurs/intervenants et contrats B2B adaptés ; règles de paiement, commissions, annulation, remboursement et litiges ; politique de confidentialité, cookies, durées de conservation et registre ; règles de contenus, droits d'auteur, musique, publicité et sponsoring ; procédures de signalement, retrait, contestation et appel ; assurance RC professionnelle/cyber et analyse des exclusions ; registre d'incidents, continuité et notification ; revue périodique par avocat, DPO, expert-comptable et spécialiste paiement selon les sujets.

Les clauses doivent être loyales et ne peuvent supprimer les droits impératifs des consommateurs, créateurs, travailleurs ou personnes concernées.

## 9. Architecture multi-pays

Le code commun ne doit pas coder en dur les règles d'un pays. Utiliser des profils pays versionnés couvrant code pays, entité contractante, devise, langue, fiscalité, PSP, politique de vérification 18+, politique de contenu, version contractuelle, région de données, politique de versement et activation des fonctionnalités.

Les décisions sensibles sont évaluées côté serveur. Le pays déclaré ne suffit pas : tenir compte des lieux d'établissement, de résidence, de transaction, de prestation et des règles de conflit de lois. Toute fonctionnalité non autorisée par la configuration validée est bloquée par défaut.

## 10. Sécurité technique et exploitation H24/7j

Exigences à tester : isolation multi-tenant stricte ; RBAC/ABAC et MFA pour rôles sensibles ; sessions HttpOnly, rotation/révocation ; chiffrement en transit et au repos ; gestion des secrets ; protections CSRF/XSS/SSRF, rate limiting et anti-abus ; journaux append-only, alertes, traces et métriques ; sauvegardes chiffrées et restauration mesurée avec RPO/RTO ; tests de charge, chaos et vulnérabilités ; séparation Preview/Staging/Production ; déploiements progressifs, approbation humaine, rollback et kill switch ; support et astreinte humaine.

La disponibilité 24/7 ne peut être annoncée qu'après définition d'un SLO, mesure réelle, couverture d'astreinte et tests de reprise. L'IA seule ne constitue pas un dispositif de secours.

## 11. Gates de lancement

Aucun passage en production tant que tous les gates applicables ne sont pas démontrés :
1. Produit : parcours complets client, intervenant, créateur, entreprise et gestionnaire.
2. Identité/18+ : tests positifs, négatifs, fraude, recours et minimisation des données.
3. Multi-tenant : tests d'accès croisés et isolation prouvée.
4. SUPRA : permissions, journaux, approbations, arrêt d'urgence et tests d'actions interdites.
5. Finance : ledger, idempotence, rapprochement, remboursements et sandbox PSP E2E.
6. Sauvegarde : export, chiffrement, dépôt, intégrité et restauration démontrés.
7. Juridique : fiches pays et contrats validés par professionnels compétents.
8. Sécurité : audit, gestion des vulnérabilités et plan d'incident.
9. Exploitation : observabilité, alertes, SLO, astreinte et reprise.
10. Frontend/API : tests E2E sur les versions exactes déployées, mobile et desktop.
11. Gouvernance : branches protégées, revues obligatoires, approbations de release et preuves archivées.

Un gate échoué ou non démontré maintient le lancement concerné en NO-GO. Une validation Preview ne vaut pas validation Production.

## 12. Plan de livraison

A. consolider les branches et dépendances existantes sans contourner les tests ;
B. finaliser la matrice pays et le modèle de rôles Nexus Talent ;
C. livrer les outils créateur et les parcours gratuits/monétisés ;
D. finaliser identité/majorité, sécurité et isolation ;
E. finaliser ledger et PSP sandbox ;
F. valider sauvegardes/restauration et exploitation H24 ;
G. effectuer les revues juridiques locales et les tests E2E ;
H. soumettre un dossier de release avec preuves et approbations humaines.

**Décision de sécurité actuelle : NO-GO Production tant que les gates ci-dessus ne sont pas tous validés.** Ce document est une spécification de travail ; il ne prouve pas que les fonctions sont déjà codées, déployées, opérationnelles ou conformes.

## 13. Registre initial de sources officielles — vérifié le 20 novembre 2026

Ce registre donne des textes de départ à intégrer dans les Country Compliance Packs. Il ne constitue ni une analyse exhaustive de leur applicabilité à PROCHÉLIA, ni un avis juridique. Chaque pack doit conserver la version consolidée, les articles pertinents, la date de vérification, le conseil local responsable et la prochaine date de revue.

### Algérie — commerce, données, paiements et lutte contre le blanchiment

- **Données personnelles — loi n° 25-11 du 24 juillet 2025**, publiée au Journal officiel n° 48 du 24 juillet 2025 : elle modifie et complète la loi n° 18-07 du 10 juin 2018. Les articles 41 bis et 41 bis 1 introduisent le cadre du délégué à la protection des données ; les articles 41 bis 2 et 41 bis 3 prévoient un registre des activités de traitement et un carnet automatisé des opérations. Le rôle de responsable/sous-traitant et l'applicabilité de chaque obligation à l'entité PROCHÉLIA doivent être établis par conseil algérien. Source primaire : [Journal officiel n° 48/2025 — PDF officiel](https://www.joradp.dz/FTP/JO-FRANCAIS/2025/F2025048.pdf).
- **Frontière importante d'interprétation :** le nouveau Titre V bis (articles 45 bis et suivants) de cette loi vise les traitements à des fins de prévention/détection des infractions, d'enquêtes, de poursuites et d'exécution des peines. Ses dispositions particulières ne doivent pas être transposées automatiquement aux traitements commerciaux ordinaires de la marketplace. En particulier, les articles 45 bis 6 à 10 (étude d'impact, sécurité, notification sous cinq jours et documentation des violations dans ce régime spécial) ne doivent pas être présentés comme des obligations générales de PROCHÉLIA sans analyse de leur champ. Pour les traitements commerciaux, le conseil doit examiner la loi 18-07 consolidée, ses dispositions générales et ses textes d'application. De même, les articles 45 bis 13 et 45 bis 14 ne doivent pas être présentés comme le régime général des transferts commerciaux.
- **Commerce électronique — loi n° 18-05 du 10 mai 2018**, Journal officiel n° 28 du 16 mai 2018 : à analyser pour l'identification du fournisseur, la présentation lisible de l'offre, le prix toutes taxes comprises, la disponibilité, les frais/délais, les conditions de vente, le paiement, la résiliation et les réclamations. Sources officielles : [Journal officiel n° 28/2018](https://www.joradp.dz/FTP/JO-FRANCAIS/2018/F2018028.pdf) et [Ministère du Commerce — loi 18-05](https://www.commerce.gov.dz/fr/reglementation/loi-n-deg-18-05).
- **Lutte contre le blanchiment — loi n° 25-10 du 24 juillet 2025**, publiée dans le même Journal officiel n° 48, modifiant la loi n° 05-01 : elle traite notamment de l'approche fondée sur les risques, de la vigilance, des bénéficiaires effectifs et des personnes politiquement exposées pour les entités assujetties. Elle prévoit aussi une interdiction relative aux actifs virtuels dans les conditions de son article 6 bis. Ne pas conclure sans analyse que PROCHÉLIA est elle-même une entité assujettie : faire qualifier séparément la plateforme, chaque activité et le PSP. Par prudence, aucune fonctionnalité de paiement en crypto-actifs, d'échange ou de valeur virtuelle assimilable ne doit être ouverte en Algérie sans avis juridique local écrit.
- **Prestataires de services de paiement :** la Banque d'Algérie répertorie le règlement n° 25-02 du 14 avril 2025 relatif à l'autorisation, l'agrément et l'exercice des activités des PSP, ainsi que l'instruction n° 06-2025 du 17 août 2025 définissant les règles régissant leur activité et leur fonctionnement. Vérifier le texte consolidé, l'agrément du prestataire et le périmètre exact des services autorisés avant tout encaissement ou versement. Sources officielles : [Banque d'Algérie — règlements PSP](https://www.bank-of-algeria.dz/importations-exportations-reglement/) et [Banque d'Algérie — instructions PSP](https://www.bank-of-algeria.dz/agrement-instruction/).

### France et Union européenne — données, plateformes et IA

- **RGPD — règlement (UE) 2016/679 :** les transferts de données hors EEE doivent être instruits au regard du chapitre V, notamment des articles 44 à 49. Ne présumer ni d'une décision d'adéquation ni de la validité d'un transfert vers l'Algérie ; documenter le mécanisme applicable, les garanties, les sous-traitants et l'information des personnes. Source : [EUR-Lex — RGPD](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng).
- **DSA — règlement (UE) 2022/2065 :** l'article 27 encadre la transparence des principaux paramètres des systèmes de recommandation des plateformes en ligne ; l'article 30 impose la traçabilité des professionnels dans le cas des plateformes en ligne permettant aux consommateurs de conclure des contrats à distance avec des professionnels, sous réserve du champ et des conditions du texte. Nexus Talent doit donc classifier séparément découverte, recommandation, publicité, réservation et vente. Source : [EUR-Lex — DSA](https://eur-lex.europa.eu/eli/reg/2022/2065).
- **AI Act — règlement (UE) 2024/1689, version consolidée consultée au 27 juillet 2026 :** l'article 50 s'applique depuis le 2 août 2026 ; il prévoit notamment l'information lorsqu'une personne interagit directement avec une IA et le marquage détectable de certains contenus synthétiques. La période limitée jusqu'au 2 décembre 2026 pour le marquage de l'article 50(2) ne concerne que les systèmes mis sur le marché avant le 2 août 2026 ; ne pas la présumer applicable à un système nouveau. Sources : [EUR-Lex — AI Act consolidé](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng) et [Commission européenne — FAQ article 50](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act).
- **Échéance du 2 décembre 2026 — interdictions de contenus générés :** le calendrier officiel de la Commission indique l'entrée en application des nouvelles interdictions visant les systèmes qui génèrent des deepfakes sexuels/intimes non consentis ou du matériel d'abus sexuels sur enfants. Avant toute fonction de génération ou d'édition d'image/vidéo, prévoir un blocage technique, des contrôles de signalement et une procédure d'escalade humaine ; aucune fonction de nudification ou de génération de tels contenus ne doit être proposée. La transition de l'article 50(2) est limitée à certains systèmes déjà mis sur le marché avant le 2 août 2026 et ne doit pas être présumée applicable à une fonction nouvelle. Sources : [Commission — calendrier d'application AI Act](https://ai-act-service-desk.ec.europa.eu/en/ai-act/eu-ai-act-implementation-timeline) et [Commission — AI Omnibus entré en vigueur le 27 juillet 2026](https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force).
- **Nexus Talent et recrutement :** l'annexe III, point 4(a), de l'AI Act vise les systèmes destinés au recrutement ou à la sélection de personnes, notamment le ciblage d'annonces, l'analyse/filtrage de candidatures et l'évaluation de candidats. Si Nexus Talent sert à présélectionner ou classer des personnes pour des missions, emplois ou accès au travail indépendant, documenter dès maintenant la qualification et le rôle de PROCHÉLIA. À la suite des modifications entrées en vigueur le 27 juillet 2026, les obligations applicables aux systèmes à haut risque de l'annexe III sont programmées au **2 décembre 2027** ; ne pas les confondre avec les obligations de transparence de l'article 50, applicables depuis le 2 août 2026, ni avec les interdictions et l'obligation de maîtrise de l'IA déjà applicables. L'article 6(3) prévoit une analyse encadrée de certains cas limités, mais un système de l'annexe III qui réalise du profilage de personnes reste toujours considéré à haut risque. Ne pas automatiser le rejet ou la sélection définitive ; prévoir explication, intervention humaine et contestation. Sources : [EUR-Lex — AI Act consolidé](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng) et [Commission — calendrier d'application](https://ai-act-service-desk.ec.europa.eu/en/ai-act/eu-ai-act-implementation-timeline).

### Conséquences produit immédiates pour Nexus Talent

1. Distinguer la simple découverte de contenus, la recommandation commerciale, la mise en relation professionnelle et la sélection pour une mission ou un emploi ; elles ne doivent pas partager automatiquement la même qualification juridique.
2. Garder les classements explicables, audités et contestables ; aucun score ne doit devenir seul décideur d'une sélection, d'une exclusion ou d'un accès à une opportunité.
3. Afficher clairement les frais, taxes connues, commissions, conditions d'annulation et revenus nets estimés ; ne pas promettre de délai de versement avant confirmation du PSP et des règles locales.
4. Garder les paiements, pourboires, cadeaux, abonnements, contenus payants et versements désactivés pays par pays tant que l'activité, le PSP, les règles de change, les remboursements et les obligations fiscales ne sont pas validés.
5. Enregistrer pour chaque pays les textes applicables, l'avis du conseil local, les fonctions autorisées/interdites, la version des contrats et la date de réexamen.
6. Pour les fonctions de génération et de diffusion de médias, bloquer les usages interdits par l'AI Act, conserver un canal de signalement et une escalade humaine, et documenter la date de mise en conformité avant le 2 décembre 2026. Une source officielle recensée ne vaut pas validation juridique.


## Veille réglementaire vérifiée — 20 novembre 2026

Cette section est une veille documentaire, pas un avis juridique. Le texte consolidé, les actes d'application et la qualification de PROCHÉLIA doivent être validés par un avocat/DPO compétent dans chaque territoire avant commercialisation.

### Union européenne — règlement IA (AI Act)

La FAQ actualisée de la Commission européenne confirme le calendrier suivant :

- Les interdictions de pratiques IA et l'obligation de maîtrise de l'IA s'appliquent depuis le 2 février 2025.
- Les obligations applicables aux modèles d'IA à usage général (GPAI) s'appliquent depuis le 2 août 2025.
- Le règlement est généralement applicable depuis le 2 août 2026, sous réserve des dispositions à calendrier spécifique.
- Après l'AI Omnibus entré en vigueur le 27 juillet 2026, les règles pour les cas à haut risque de l'annexe III — notamment certains usages en emploi, gestion des travailleurs et accès au travail indépendant — sont reportées au 2 décembre 2027. Les systèmes à haut risque intégrés à des produits réglementés suivent l'échéance du 2 août 2028.
- Les obligations de transparence de l'article 50 concernant certains systèmes interactifs et contenus synthétiques s'appliquent depuis le 2 août 2026.

**Conséquence à instruire pour Nexus Talent :** le ciblage d'annonces, le filtrage de candidatures, l'évaluation de candidats ou l'affectation algorithmique de personnes à des missions peuvent relever des cas d'emploi/gestion des travailleurs selon la finalité réelle, les utilisateurs et le rôle de PROCHÉLIA. Un simple report d'échéance ne dispense pas des obligations déjà applicables. La classification doit être faite fonction par fonction ; ne pas attribuer automatiquement la même qualification à toute recommandation ou mise en relation.

Mesures de conception à conserver : décision humaine pour les décisions ayant un effet significatif sur une personne, traçabilité, information compréhensible, contestation, tests de biais, gestion des risques, contrôle des données et séparation entre recommandation et décision finale.

Source primaire : [Commission européenne — Navigating the AI Act](https://digital-strategy.ec.europa.eu/en/faqs/navigating-ai-act).

### Algérie — données personnelles et services de confiance

- **Loi n° 25-11 du 24 juillet 2025 :** elle modifie et complète la loi n° 18-07 relative à la protection des personnes physiques dans le traitement des données personnelles. La matrice Algérie doit être fondée sur le texte consolidé, les formalités auprès de l'ANPDP, les règles de conservation, les transferts internationaux et les décisions d'application pertinentes. Source officielle de référence : [ARPCE — lois et règlements](https://www.arpce.dz/en/reg/loi) ; [Journal officiel n° 48/2025 — PDF](https://www.joradp.dz/FTP/JO-FRANCAIS/2025/F2025048.pdf).
- **Loi n° 26-02 du 17 février 2026 :** l'ARPCE la répertorie comme établissant les règles générales relatives aux services de confiance pour les transactions électroniques et à l'identification électronique. Avant d'utiliser une signature, un certificat, un prestataire d'identification ou de revendiquer une équivalence juridique en Algérie, vérifier le texte intégral, les catégories de prestataires, les agréments et les textes d'application avec un conseil local. Source officielle : [ARPCE — présentation de la loi n° 26-02](https://www.arpce.dz/en/pub/n0z6w6).

### Actions de conformité à maintenir

1. Tenir des registres de traitement et journaux d'opérations distincts France/UE et Algérie, avec responsable, finalité, base légale, durée, sous-traitants, localisation et mécanisme de transfert.
2. Ne pas confondre assurance d'âge, KYC/KYB, vérification de qualification professionnelle et identification électronique qualifiée.
3. Ne pas collecter de biométrie par défaut ; toute nécessité doit être démontrée, proportionnée et validée localement.
4. Ne pas faire d'un score Nexus Talent une décision automatique d'accès à une mission, à un revenu ou à une opportunité sans analyse de risque, explication, recours et contrôle humain.
5. Obtenir une validation écrite d'un conseil français/UE et d'un conseil algérien avant activation des parcours concernés.

## 12. Exigences intégrales de pilotage PROCHÉLIA par NEXUS SUPRA

NEXUS SUPRA est le plan de contrôle transversal de PROCHÉLIA, et non un chatbot ni une collection d'agents indépendants sans gouvernance. Il coordonne les domaines Client, Intervenant, Gérant/Entreprise, Talent, LIVE, marketplace de services, finance, support, conformité, sécurité, administration et infrastructure. Chaque domaine conserve ses propres permissions, données, règles métier et responsables.

### 12.1 Cycle opérationnel commun

Pour chaque événement ou demande, le système doit suivre un cycle traçable :
1. recevoir l'événement depuis une source authentifiée ;
2. vérifier l'identité, le tenant, les permissions, le pays et le contexte ;
3. valider les données et leur fraîcheur ;
4. qualifier le fait, l'hypothèse, l'incertitude et la source ;
5. analyser les impacts métier, humains, juridiques, financiers et techniques ;
6. calculer la priorité, la gravité et les options de résolution ;
7. appliquer une politique versionnée et vérifier les autorisations ;
8. exécuter uniquement les actions permises, avec idempotence et limites ;
9. contrôler le résultat réel et les effets secondaires ;
10. notifier les personnes habilitées, ouvrir un recours si nécessaire et conserver la preuve ;
11. réévaluer la situation jusqu'à résolution ou transfert explicite à un responsable humain.

Une intention, une recommandation ou une réponse HTTP positive ne constitue pas une preuve suffisante d'exécution réussie. Les états « proposé », « approuvé », « exécuté », « vérifié », « échoué » et « annulé » doivent être distincts.

### 12.2 Matrice d'autonomie et d'approbation

- Automatisable après tests : surveillance, alertes, classement d'incidents, recommandations explicables, contrôles de cohérence, relances non sensibles et opérations techniques réversibles sous politique approuvée.
- Autorisation conditionnelle : suspension temporaire d'une action ou d'un compte en présence d'un signal grave, avec proportionnalité, information, durée limitée, journalisation et recours.
- Validation humaine obligatoire : transfert ou remboursement hors règles préapprouvées, changement de coordonnées bancaires, engagement contractuel, modification des tarifs/commissions, décision définitive de sanction, décision ayant un effet significatif sur une personne, avis juridique définitif, déclaration réglementaire, migration destructive, déploiement production et suppression irréversible.
- Interdit : contourner les contrôles, falsifier une preuve, inventer un statut de conformité, masquer un incident ou utiliser des données sans base légale.

Chaque action doit porter un identifiant de corrélation, l'acteur ou agent, la politique/version, le motif, les sources, les permissions vérifiées, l'approbateur éventuel, l'horodatage, le résultat et le lien vers les éléments de preuve. Les journaux critiques doivent être append-only avec contrôle d'intégrité et accès restreint.

### 12.3 Espace Intervenant — parcours professionnel de bout en bout

L'interface intervenant doit être une application opérationnelle responsive et accessible, pas un tableau de bord décoratif. Elle doit couvrir : inscription sur invitation ou parcours validé, majorité et identité selon nécessité, profil, compétences et justificatifs, vérifications et recours, disponibilités, opportunités, candidatures, affectations, planning, instructions de mission, démarrage/fin avec preuve proportionnée, incidents terrain, messagerie sécurisée, documents, factures, revenus estimés/disponibles/en attente, demandes de versement via PSP autorisé, historique, support, sécurité des appareils, formation et évolution professionnelle.

Chaque transition doit être autorisée côté serveur, tenant-scoped, idempotente et auditée. La preuve d'appareil ne vaut pas preuve de présence. Aucune mission ne peut être démarrée ou clôturée sur la seule base d'un signal client non vérifié. Les justificatifs sensibles sont déposés dans un flux sécurisé, avec accès minimal et durée de conservation définie.

### 12.4 Talent, créateurs et PROCHÉLIA LIVE

Le domaine Talent doit permettre un profil public contrôlé, portfolio, studio de publication, live, calendrier, communauté, modération, ateliers, événements, réservations, contenus payants facultatifs, offres et partenariats. Les spectateurs peuvent accéder gratuitement aux contenus annoncés comme gratuits. Les outils de croissance doivent aider les talents émergents sans promettre de portée ni de revenus.

SUPRA peut recommander des horaires, formats, sujets, collaborations, prix et canaux de distribution à partir de données licites et mesurables. Il doit distinguer audience organique, sponsorisée, artificielle et frauduleuse ; expliquer les recommandations ; mesurer les résultats ; détecter les manipulations et permettre la contestation. La monétisation doit afficher avant engagement le prix, frais, taxes connues, commission, net estimé, conditions et délai réellement confirmé par le PSP. Aucun paiement, cadeau, pourboire, abonnement ou versement n'est activé avant les validations pays/PSP/fiscales/juridiques correspondantes.

### 12.5 Protection anti-fraude et cybersécurité transversales

Le dispositif doit traiter les risques de faux comptes client/intervenant/talent/entreprise, usurpation, documents falsifiés, bots, faux avis, faux abonnés, détournement de session, credential stuffing, force brute, CSRF, XSS, injection, SSRF, abus d'API, DDoS, fraude au paiement, remboursements abusifs, faux justificatifs, détournement de mission, compromission administrateur, exfiltration et rançongiciel.

Contrôles requis : MFA pour rôles sensibles, sessions HttpOnly avec rotation/révocation, séparation stricte des tenants, moindre privilège, limites de débit, validation serveur, protection des secrets, chiffrement, surveillance, détection d'anomalies, sauvegardes testées, réponse à incident, notification légale lorsque requise et tests d'intrusion indépendants. Les scores antifraude sont des signaux, non une preuve définitive ; prévoir contrôle humain et recours avant sanction durable.

### 12.6 Juridique, conformité et protection des personnes

Toute évolution produit, tarif, partenariat, modèle de revenu, collecte de données ou nouveau pays déclenche une analyse d'impact juridique et conformité. Le résultat référence les textes officiels, leur version/date, le pays, le rôle de PROCHÉLIA, les faits connus, les incertitudes, les documents concernés, l'avis du conseil local requis, le responsable et la date de réexamen. Les CGU/CGV, contrats, politique de confidentialité, cookies, règles LIVE, modération, remboursement, réclamation et politiques de sécurité sont versionnés et liés aux parcours réels.

Les documents contractuels ne peuvent pas supprimer les responsabilités légales ni les droits impératifs des personnes. NEXUS SUPRA ne garantit aucune immunité personnelle ou sociale : il réduit les risques par la prévention, les preuves, la gouvernance, les assurances adaptées et la revue par avocats, DPO, experts-comptables et spécialistes locaux.

### 12.7 Continuité H24/7J7 et résilience

L'objectif 24/7 exige des SLO mesurés, supervision indépendante, alertes, astreinte humaine, budgets de capacité, files de reprise, redondance adaptée, sauvegardes chiffrées, exercices de restauration, objectifs RPO/RTO approuvés, tests de charge, tests de panne, déploiements progressifs, rollback et kill switch. L'IA ne remplace ni l'astreinte ni les procédures de secours. Les incidents doivent être détectés, classés, contenus, résolus, vérifiés et faire l'objet d'un retour d'expérience.

## 13. Critères de recette intégrale — preuves exigées avant production

La recette est menée par parcours et par rôle, sur un environnement isolé représentatif :
- parcours complets Client, Intervenant, Gérant/Entreprise et Talent, sur mobile et ordinateur ;
- séparation des données entre tenants et tests d'accès croisés négatifs ;
- authentification, MFA, révocation de session, récupération et protection anti-abus ;
- invitations, vérification d'âge/identité proportionnée, compétences et recours ;
- réservation, candidature, affectation, démarrage, clôture, preuves, incident et litige ;
- publication, live, modération, signalement, droits médias, achats facultatifs et reversements Sandbox ;
- idempotence, concurrence, ledger, rapprochement, remboursements et webhooks PSP ;
- RGPD : registre, bases légales, information, consentements lorsqu'exigés, droits, conservation, suppression, sous-traitants, transferts et procédure de violation ;
- conformité par pays, avis juridiques locaux, contrats et assurances ;
- tests de sécurité, intrusion, charge, accessibilité, compatibilité navigateur et mobile ;
- sauvegarde fraîche, intégrité, restauration isolée et preuve de reprise ;
- supervision, alertes, astreinte, SLO, RPO/RTO et exercices d'incident ;
- audit des actions SUPRA, permissions, approbations, kill switch et recours.

Chaque preuve doit identifier le commit, l'environnement, la date, le test, le résultat, les écarts et le responsable. Les contrôles non exécutés sont « non vérifiés », jamais « réussis ». Production reste NO-GO tant qu'un gate critique est ouvert ou qu'une validation humaine requise manque.


## 14. NEXUS SHIELD — confiance, anti-harcèlement, anti-escroquerie, anti-piratage et cybersécurité

NEXUS SHIELD est le dispositif transversal de confiance et de sécurité, coordonné par NEXUS SUPRA. Il couvre les comptes, profils, messages, contenus, lives, réservations, missions, paiements, entreprises, intervenants et espaces Jeunes Talents. Il s'appuie sur les contrôles serveur et des opérateurs humains; une IA ou un score de risque n'est jamais une preuve définitive.

### Prévention et détection
- Défense des comptes: passkeys/MFA pour les rôles sensibles, limitation des tentatives, détection du credential stuffing, protection contre phishing, sessions révocables, alertes de connexion inhabituelle et récupération de compte renforcée.
- Défense applicative: validation serveur, moindre privilège, isolation des tenants, protection XSS/CSRF/SSRF/injection, contrôle des fichiers, secrets hors code, chiffrement, rotation, sauvegardes restaurables, surveillance des API et protections anti-bot/DDoS adaptées.
- Anti-escroquerie: détection des faux profils, usurpations, documents incohérents, faux avis, faux abonnés, demandes de paiement hors plateforme, fausses preuves de mission, fraude au remboursement, manipulation des commissions et abus de promotions.
- Anti-harcèlement: détection du harcèlement répété, menaces, chantage, discrimination, doxxing, stalking, spam, raids coordonnés et sollicitations sexuelles non désirées; outils bloquer, masquer, limiter, filtrer et signaler.
- Anti-piratage et droits: procédure de signalement de contenus contrefaisants, preuve de titularité ou mandat, retrait/suspension selon procédure, contre-notification lorsque requise, gestion des récidivistes et traçabilité. Aucun retrait automatique irréversible sur une simple détection de similarité.
- Protection des mineurs: contrôles renforcés, prévention du grooming, séparation des espaces et contacts, modération prioritaire et escalade urgente.

### Réponse graduée et équitable
1. Un signal ou score déclenche une analyse; il ne suffit pas à conclure à une fraude ou à bannir.
2. En cas de risque immédiat, SUPRA peut appliquer une mesure temporaire, proportionnée et réversible préautorisée: masquer un contenu, couper un contact, ralentir une action, bloquer temporairement un paiement suspect via le PSP ou geler une session compromise.
3. L'utilisateur reçoit une information adaptée, un motif compréhensible, la durée ou le statut de la mesure et un canal de contestation, sauf exception légale de confidentialité.
4. Les sanctions durables, fermetures définitives, confiscations, accusations publiques et décisions contestées exigent une revue humaine habilitée et une preuve suffisante.
5. Les signalements urgents liés à une menace physique ou à un mineur sont priorisés et escaladés selon une procédure documentée.
6. Prévoir contrôle des faux positifs, protection contre les signalements malveillants et recours accessible aux personnes visées.

### Gouvernance SUPRA et preuves
Chaque décision enregistre: identifiant d'événement, tenant, compte/ressource concerné, source du signal, faits observés séparés des hypothèses, règle et version, niveau de confiance, mesure, durée, acteur automatique/humain, approbation, notification, résultat et recours. Accès aux preuves limité, conservation définie, intégrité protégée et suppression à échéance. Les données sensibles ne sont pas utilisées pour inférer un diagnostic ou profiler la vulnérabilité psychologique d'une personne.

### Conditions de mise en service
Avant activation: tests adversariaux, scénarios de faux positifs, abus coordonnés, récupération de compte, compromission d'administrateur, fraude au paiement, signalement/retrait/recours, protection mineurs, tests d'isolation multi-tenant, plan d'incident, astreinte et audit indépendant. Sans preuve d'exécution, la fonction est marquée « spécifiée, non vérifiée » et ne doit pas être présentée comme opérationnelle.
