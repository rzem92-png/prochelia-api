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

### E. Union européenne — règlement IA (AI Act) modifié par le règlement (UE) 2026/1744

Le règlement (UE) 2026/1744 du 8 juillet 2026, publié au Journal officiel le 24 juillet 2026 et applicable à compter du 27 juillet 2026, modifie le règlement (UE) 2024/1689. Il ne reporte pas l'ensemble de l'AI Act : il ajuste certaines obligations et le calendrier des exigences applicables aux systèmes à haut risque.

Points de calendrier à intégrer :

- Les chapitres I et II de l'AI Act s'appliquent depuis le 2 février 2025. L'article 4, dans sa rédaction issue du règlement 2026/1744, impose aux fournisseurs et déployeurs de prendre des mesures pour soutenir le développement de la maîtrise de l'IA de leurs équipes et des personnes qui opèrent ou utilisent les systèmes pour leur compte ; il ne leur impose pas de garantir un niveau individuel déterminé.
- Les obligations de transparence de l'article 50 relèvent du calendrier général d'application du 2 août 2026. Les personnes qui interagissent directement avec un système d'IA doivent notamment être informées qu'elles interagissent avec une IA, sauf si cela ressort clairement du contexte.
- **Transition spécifique à l'article 50(2) :** pour les systèmes d'IA générant du contenu audio, image, vidéo ou texte synthétique déjà mis sur le marché avant le 2 août 2026, l'article 111(4), modifié par le règlement 2026/1744, prévoit que les fournisseurs prennent les mesures nécessaires pour se conformer à l'article 50(2) au plus tard le 2 décembre 2026. Cette échéance transitoire doit être distinguée de l'application générale de l'article 50.
- **Précision de la Commission européenne (FAQ Article 50, consultée le 24 novembre 2026) :** la tolérance jusqu'au 2 décembre 2026 est limitée aux obligations de marquage/détection de l'article 50(2) et aux systèmes déjà mis sur le marché avant le 2 août 2026. Elle ne doit pas être utilisée comme report général de l'article 50, notamment pour l'information des personnes qui interagissent directement avec un système d'IA (article 50(1)). La Commission précise également que les contenus générés avant le 2 août 2026 ne nécessitent pas d'étiquetage rétroactif. Les lignes directrices publiées le 20 juillet 2026 apportent les précisions d'interprétation sur les obligations de transparence.
- Les nouvelles interdictions de l'article 5(1), points (ba) et (bb), ainsi que les paragraphes 1a et 1b correspondants, s'appliquent à partir du 2 décembre 2026. Elles concernent notamment certains systèmes générant ou manipulant, sans consentement explicite, des représentations intimes réalistes de personnes identifiables ou du matériel d'abus sexuels sur enfants ; ce n'est pas une fonctionnalité prévue pour PROCHÉLIA, mais cette échéance doit être suivie.
- Les exigences du chapitre III, sections 1 à 3, pour les systèmes à haut risque de l'article 6(2) / annexe III sont reportées au 2 décembre 2027. Pour les systèmes à haut risque de l'article 6(1) / annexe I, la date est le 2 août 2028. Ce report ne constitue pas une exemption ni une autorisation d'usage sans garanties.

**Point de vigilance PROCHÉLIA / NEXUS SUPRA :** l'annexe III, point 4, vise notamment les systèmes utilisés pour recruter ou sélectionner des personnes (ciblage d'annonces, analyse/filtrage de candidatures, évaluation de candidats), prendre des décisions affectant les conditions de travail ou la promotion/rupture d'une relation de travail, attribuer des tâches selon le comportement ou des caractéristiques personnelles, ou surveiller/évaluer les performances et comportements. Si NEXUS SUPRA est utilisé à ces fins, certaines fonctions peuvent relever du haut risque selon leur destination réelle et leur rôle dans la décision. La qualification doit être faite fonction par fonction, en distinguant aide administrative, recommandation, classement, allocation de missions et décision effective.

**Mesures de conception à retenir dès maintenant :** pas de rejet, suspension, sanction, rupture ou décision de rémunération entièrement automatisés ; décision humaine traçable, explication compréhensible, contestation, tests de biais, limitation des données, journal des recommandations et des validations, séparation des rôles fournisseur/déployeur et formation des personnes concernées. Ne pas utiliser de données sensibles pour corriger des biais sans base légale et garanties spécifiques ; l'article 4a introduit par le règlement 2026/1744 prévoit un cadre exceptionnel, strictement nécessaire et documenté.

## 2. Exigences à traduire en produit et contrôles

| Domaine | Exigence de conception à instruire | Preuve attendue |
|---|---|---|
| Gouvernance des données | Registre France RGPD et registre Algérie loi 18-07 modifiée | Registres versionnés, responsables, finalités, bases, destinataires, durées |
| DPO / contacts | Vérifier la désignation et les notifications requises dans chaque pays | Décision de désignation, coordonnées, périmètre, procédures |
| Journal des traitements | Distinguer journal technique, journal d'activité, audit Nexus Supra et carnet légal des traitements | Motif, date/heure, acteur, opération, destinataire, intégrité et accès contrôlé |
| Profilage | Inventorier scores de fiabilité, performance, fraude, matching et géolocalisation | Fiches de finalité, variables, seuils, tests de biais, explication, recours humain |
| IA / AI Act | Qualifier les fonctions NEXUS SUPRA au regard de l'annexe III, point 4, et du calendrier modifié par 2026/1744 | Inventaire des finalités, classification par fonction, supervision humaine, tests de biais, information des utilisateurs, mesures de maîtrise de l'IA |
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
9. NEXUS SUPRA est-il utilisé pour filtrer des candidatures, évaluer des intervenants, attribuer des missions selon des caractéristiques individuelles ou suivre les performances ? Pour chaque fonction, qui est fournisseur/déployeur, quel niveau d'influence l'IA exerce-t-elle et quelles exigences AI Act / droit du travail s'appliquent ?

## 4. Décision provisoire

- **France :** pas de validation DSA/RGPD/consommation/fiscalité obtenue ; qualification de la plateforme et cartographie des transferts à faire valider.
- **Algérie :** la loi 25-11 du 24 juillet 2025 doit être intégrée à la matrice ; la désignation DPO, les registres et le carnet automatisé des opérations doivent être instruits.
- **Paiements :** aucun mouvement réel ne doit être activé avant avis juridique local, contrat PSP, recette Sandbox complète et autorisation humaine.
- **IA / AI Act :** le règlement 2026/1744 reporte certaines exigences haut risque de l'annexe III au 2 décembre 2027, mais les obligations générales, la transparence et les mesures de maîtrise de l'IA sont déjà applicables selon leur calendrier. La qualification de NEXUS SUPRA et les garde-fous RH doivent être validés avant toute décision automatisée.
- **Automatisation Nexus Supra :** recommandations et contrôles traçables seulement ; aucune décision juridique, fiscale, de paiement ou de suspension définitive sans validation humaine compétente.

## 5. Sources officielles consultées

- Journal officiel algérien n° 48 du 24 juillet 2025, loi n° 25-11 (modification de la loi 18-07) et loi n° 25-10 : https://www.joradp.dz/FTP/JO-FRANCAIS/2025/F2025048.pdf
- Règlement (UE) 2026/1744 du 8 juillet 2026 modifiant l'AI Act, JOUE du 24 juillet 2026 : https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng/pdf
- AI Act consolidé au 27 juillet 2026 (règlement 2024/1689 modifié) : https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng
- ANPDP, notice relative à la protection des données personnelles : https://plaintes.anpdp.dz/notice.php
- Règlement (UE) 2022/2065 — Digital Services Act, notamment articles 29 à 32 : https://eur-lex.europa.eu/eli/reg/2022/2065
- Commission européenne, impact du DSA sur les plateformes : https://digital-strategy.ec.europa.eu/en/policies/dsa-impact-platforms
- Commission européenne, FAQ officielle sur les obligations de transparence de l'article 50 (application au 2 août 2026 et transition limitée à l'article 50(2)) : https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
- Commission européenne, lignes directrices sur les obligations de transparence des fournisseurs et déployeurs, publiées le 20 juillet 2026 : https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems
- Commission européenne, décisions d'adéquation : https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en
- CNIL, guide final d'analyse d'impact des transferts de données (AITD), publié en juillet 2025 : https://www.cnil.fr/en/node/166593
- CNIL, clauses contractuelles types de la Commission européenne : https://www.cnil.fr/fr/transfert-de-donnees-les-clauses-contractuelles-types-cct-de-la-commission-europeenne

---
**Limite :** cette veille identifie des textes et des sujets à examiner. Elle ne tranche pas leur application à la structure juridique, aux effectifs, aux parcours ou aux flux réels de PROCHÉLIA. Validation requise par avocat/DPO et, pour les paiements/comptabilité, professionnels habilités.
