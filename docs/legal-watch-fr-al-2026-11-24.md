# PROCHÉLIA — veille juridique France / Algérie
**État de veille : 24 novembre 2026**  
**Statut : note de cadrage documentaire — à faire valider par un avocat et un DPO compétents dans chaque juridiction.**  
Cette note ne constitue ni un avis juridique ni une validation de conformité.

## 1. Alertes prioritaires

### A. Algérie — loi n° 25-11 du 24 juillet 2025 modifiant la loi n° 18-07

Le Journal officiel algérien n° 48 du 24 juillet 2025 publie la loi n° 25-11, qui modifie et complète la loi n° 18-07 sur la protection des données personnelles.

Points à intégrer dans la matrice Algérie :

- Les définitions de données biométriques, profilage, pseudonymisation et violation de données sont précisées/ajoutées. La définition du profilage vise notamment l'évaluation du rendement au travail, de la situation économique, de la fiabilité, du comportement, de la localisation et des déplacements.
- Un chapitre relatif au délégué à la protection des données ajoute les articles 41 bis et 41 bis 1 : désignation du DPO par le responsable du traitement, communication de ses coordonnées à l'ANPDP et missions de conseil/contrôle.
- Les articles 41 bis 2 et 41 bis 3 ajoutent un registre des activités de traitement et un carnet automatisé des opérations (collecte, inscription, conservation, consultation, modification, communication, chiffrement, effacement, etc.), avec motifs, date/heure et, dans la mesure du possible, identité des utilisateurs et destinataires.
- Le nouveau Titre V bis (articles 45 bis et suivants) porte spécifiquement sur les traitements effectués à des fins de prévention/détection des infractions et de procédure pénale. Ses dispositions particulières sur l'étude d'impact, la notification d'une violation dans un délai maximal de cinq jours et les transferts doivent être lues dans ce périmètre ; ne pas transposer automatiquement ce délai de cinq jours aux traitements commerciaux ordinaires de PROCHÉLIA sans avis juridique.

**Impact produit à instruire :** les scores de fiabilité des intervenants, les évaluations de performance, la détection de fraude, les données de localisation et les parcours de vérification d'identité peuvent relever de données personnelles et, selon les méthodes utilisées, du profilage. Cartographier les finalités, bases juridiques, données, destinataires, durées, droits, interventions humaines et mécanismes de contestation.

### B. France / Union européenne — transferts de données vers l'Algérie

La liste actuelle des décisions d'adéquation de la Commission européenne ne mentionne pas l'Algérie. Il ne faut donc pas traiter l'Algérie comme un pays bénéficiant d'une décision d'adéquation RGPD.

Avant tout transfert de données personnelles depuis une entité soumise au RGPD vers une entité algérienne juridiquement distincte ou un sous-traitant algérien :

- cartographier les flux réels, y compris accès support, hébergement, sauvegardes, logs et sous-traitants ultérieurs ;
- déterminer l'outil du chapitre V RGPD applicable (par exemple clauses contractuelles types, le cas échéant) ;
- réaliser l'analyse d'impact des transferts (AITD/TIA) lorsque requise par l'utilisation d'un outil de l'article 46 ;
- documenter les mesures techniques, organisationnelles et contractuelles supplémentaires ;
- faire valider la structure des responsables de traitement, responsables conjoints et sous-traitants.

La qualification de « transfert » doit être examinée au regard des entités juridiques réelles : un accès depuis un pays tiers par une entité distincte peut constituer un transfert ; un accès interne au sein de la même entité n'est pas automatiquement un transfert au sens du chapitre V.

### C. DSA — qualification éventuelle de place de marché

Le modèle PROCHÉLIA met en relation des clients et des intervenants/entreprises pour des prestations. Si l'interface permet à des consommateurs de conclure des contrats à distance avec des professionnels via la plateforme, faire analyser la qualification de place de marché en ligne au sens du DSA.

Si le régime de la section 4 s'applique, l'article 30 impose notamment des informations d'identification du professionnel avant qu'il puisse proposer des services aux consommateurs de l'Union, ainsi que des efforts raisonnables de vérification ; l'article 31 porte sur la conformité dès la conception de l'interface et l'article 32 sur l'information des consommateurs dans certains cas de services illégaux. Vérifier aussi l'éventuelle exemption des micro et petites entreprises prévue par l'article 29 et ses exceptions.

Indépendamment de cette qualification, faire vérifier les obligations générales applicables aux services intermédiaires, notamment le mécanisme de notification et d'action, le traitement des réclamations et la transparence des conditions.

### D. Algérie — vigilance sur les actifs virtuels

La loi n° 25-10 du 24 juillet 2025 modifie le cadre algérien de lutte contre le blanchiment et le financement du terrorisme et introduit notamment une interdiction relative à l'émission, l'achat, la vente, l'utilisation, la détention, la promotion et l'exploitation de plateformes d'échange d'actifs virtuels dans les conditions prévues par le texte.

La même loi modifie aussi le cadre LBC/FT : approche fondée sur les risques, vigilance à l'égard des clients et identification du bénéficiaire effectif pour les « assujettis » visés par le texte. Faire déterminer par un conseil algérien si PROCHÉLIA relève elle-même d'une catégorie assujettie ou si ces obligations sont portées par le PSP et d'autres partenaires réglementés ; ne pas transférer automatiquement au produit des obligations qui ne s'appliqueraient qu'à ces assujettis.

Le périmètre PROCHÉLIA doit rester fondé sur des moyens de paiement autorisés et des PSP habilités. Ne pas introduire de crypto-actifs, jetons de paiement ou mécanismes assimilables pour le pilote Algérie sans avis juridique local préalable.

## 2. Exigences à traduire en produit et contrôles

| Domaine | Exigence de conception à instruire | Preuve attendue |
|---|---|---|
| Gouvernance des données | Registre France RGPD et registre Algérie loi 18-07 modifiée | Registres versionnés, responsables, finalités, bases, destinataires, durées |
| DPO / contacts | Vérifier la désignation et les notifications requises dans chaque pays | Décision de désignation, coordonnées, périmètre, procédures |
| Journal des traitements | Distinguer journal technique, journal d'activité, audit Nexus Supra et carnet légal des traitements | Motif, date/heure, acteur, opération, destinataire, intégrité et accès contrôlé |
| Profilage | Inventorier scores de fiabilité, performance, fraude, matching et géolocalisation | Fiches de finalité, variables, seuils, tests de biais, explication, recours humain |
| Identité des professionnels | Définir les pièces, registres et auto-certifications nécessaires selon le DSA et le droit national | Dossier vérifié, source, date, résultat, prochaine revue |
| Transferts internationaux | Séparer les flux France/EEE, Algérie et sous-traitants | Cartographie, contrats, SCC si applicables, AITD/TIA, mesures supplémentaires |
| Incidents | Procédure distincte par juridiction et type de traitement | Détection, horodatage, qualification, notification, preuve de décision |
| Réclamations | Canal simple, accusé de réception, décision motivée, recours et conservation | Dossier de réclamation et journal append-only |
| Paiements | Déterminer qui fournit le service de paiement, détient les fonds et porte les obligations AML/KYC | Contrat PSP, avis juridique, matrice des responsabilités, recette Sandbox |

## 3. Questions à faire trancher par les professionnels

1. PROCHÉLIA est-elle une place de marché DSA, un simple intermédiaire, un mandataire ou une combinaison de rôles selon les parcours ?
2. L'entreprise relève-t-elle de l'exemption micro/petite entreprise pour certaines obligations DSA, et à quelles dates/conditions ?
3. Quelle entité est responsable du traitement en France et en Algérie ? Quelles entités sont sous-traitantes ou responsables conjoints ?
4. Quelles opérations constituent des transferts RGPD vers l'Algérie, notamment pour l'accès support, les sauvegardes, la télémétrie et les sous-traitants ?
5. Quelles formalités, déclarations, autorisations, désignations DPO et règles de conservation résultent de la loi 18-07 modifiée et de ses textes d'application ?
6. Les scores d'intervenants, de fiabilité et de fraude constituent-ils du profilage à risque élevé ? Quelles évaluations d'impact et garanties sont nécessaires ?
7. Quel est le rôle exact de PROCHÉLIA vis-à-vis des fonds, remboursements et reversements, et quelles obligations réglementaires s'appliquent au PSP et à la plateforme ?
8. Quelles obligations sectorielles s'appliquent selon les prestations proposées (services à la personne, garde, travaux, transport, soins ou autres activités réglementées) ?

## 4. Décision provisoire

- **France :** pas de validation DSA/RGPD/consommation/fiscalité obtenue ; qualification de la plateforme et cartographie des transferts à faire valider.
- **Algérie :** la loi 25-11 du 24 juillet 2025 doit être intégrée à la matrice ; la désignation DPO, les registres et le carnet automatisé des opérations doivent être instruits.
- **Paiements :** aucun mouvement réel ne doit être activé avant avis juridique local, contrat PSP, recette Sandbox complète et autorisation humaine.
- **Automatisation Nexus Supra :** recommandations et contrôles traçables seulement ; aucune décision juridique, fiscale, de paiement ou de suspension définitive sans validation humaine compétente.

## 5. Sources officielles consultées

- Journal officiel algérien n° 48 du 24 juillet 2025, loi n° 25-11 (modification de la loi 18-07) et loi n° 25-10 : https://www.joradp.dz/FTP/JO-FRANCAIS/2025/F2025048.pdf
- ANPDP, notice relative à la protection des données personnelles : https://plaintes.anpdp.dz/notice.php
- Règlement (UE) 2022/2065 — Digital Services Act, notamment articles 29 à 32 : https://eur-lex.europa.eu/eli/reg/2022/2065
- Commission européenne, impact du DSA sur les plateformes : https://digital-strategy.ec.europa.eu/en/policies/dsa-impact-platforms
- Commission européenne, décisions d'adéquation : https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en
- CNIL, guide final d'analyse d'impact des transferts de données (AITD), publié en juillet 2025 : https://www.cnil.fr/en/node/166593
- CNIL, clauses contractuelles types de la Commission européenne : https://www.cnil.fr/fr/transfert-de-donnees-les-clauses-contractuelles-types-cct-de-la-commission-europeenne

---
**Limite :** cette veille identifie des textes et des sujets à examiner. Elle ne tranche pas leur application à la structure juridique, aux effectifs, aux parcours ou aux flux réels de PROCHÉLIA. Validation requise par avocat/DPO et, pour les paiements/comptabilité, professionnels habilités.
