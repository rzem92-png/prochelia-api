# PROCHÉLIA — Rentabilité durable et économie unitaire

Statut : spécification métier à implémenter et à valider. Ce document ne constitue ni une garantie de rentabilité ni une autorisation de lancement commercial.

## 1. Principe non négociable

Chaque mission doit être économiquement viable, compréhensible par le client et rémunératrice pour l'intervenant. Le système ne doit jamais masquer une perte par un chiffre d'affaires brut, une commission théorique ou une trésorerie indisponible.

La rentabilité doit être évaluée avant publication, avant acceptation par l'intervenant et après clôture réelle de la mission.

## 2. Calcul canonique par mission

Toutes les sommes sont stockées en unités monétaires mineures entières (centimes ou unité mineure locale), avec un code devise ISO 4217 explicite. Aucun calcul financier ne repose sur des nombres flottants.

Pour chaque mission, conserver un instantané immuable des paramètres et montants acceptés :

- prix payé par le client, hors taxes et taxes séparées ;
- rémunération brute promise à l'intervenant ;
- commission PROCHÉLIA et éventuels frais de service ;
- frais PSP réellement applicables ;
- coûts variables attribuables : vérification, assurance, assistance, notifications, cartographie, déplacement subventionné et traitement des incidents ;
- remises, avoirs, remboursements, annulations et coûts de contestation ;
- réserve de risque explicite et justifiée ;
- montant net estimé pour l'intervenant et date/modalités prévisionnelles de paiement.

Formule de contribution de la mission :

`Contribution = revenu plateforme HT - rémunération intervenant - frais PSP - coûts variables directs - remises financées par PROCHÉLIA - pertes attendues documentées`

Le revenu plateforme HT ne doit pas inclure les taxes collectées pour le compte des autorités, les fonds dus aux intervenants ou les montants détenus pour des tiers.

`Taux de contribution = contribution / revenu plateforme HT`

Si le dénominateur est nul ou négatif, le taux est déclaré non calculable et la mission est bloquée pour revue.

## 3. Garde-fous de tarification

- Définir un plancher de contribution par pays, devise, catégorie de service et canal commercial, après validation comptable et juridique.
- Refuser ou soumettre à approbation toute mission sous le plancher ; aucune promotion ne peut contourner cette règle.
- Afficher au client le prix total, les frais, les taxes et les règles d'annulation avant confirmation.
- Afficher à l'intervenant le montant brut, les retenues autorisées, les frais éventuels, le net estimé et les conditions de paiement avant acceptation.
- Geler l'instantané économique à l'acceptation. Toute modification nécessite un accord explicite des parties et une nouvelle trace d'audit.
- Interdire les baisses rétroactives unilatérales de rémunération.
- Les prix dynamiques utilisent des facteurs explicables (zone de service, durée, urgence, disponibilité agrégée, coûts vérifiés) ; aucune donnée sensible ni inférence protégée ne sert à discriminer.
- Les remises sont imputées à un budget identifié (plateforme, partenaire ou client) et ne réduisent jamais silencieusement la rémunération promise.

## 4. Revenus et trésorerie : ne pas confondre

Le chiffre d'affaires, la marge, la contribution, les créances, les fonds en transit, le solde disponible et les reversements dus sont des notions distinctes.

- Le portefeuille intervenant présente séparément : en attente, disponible, réservé, payé et contesté.
- Un reversement demandé ne devient pas un reversement payé avant confirmation PSP signée et rapprochée.
- Le ledger est append-only : corrections par écritures compensatoires, jamais par écrasement d'une écriture financière.
- Chaque opération financière est idempotente, liée à son propriétaire, à la mission et à une clé de rapprochement.
- Les remboursements, litiges, annulations, impayés et chargebacks sont rapprochés au niveau de la mission.
- Les fonds des clients et les sommes dues aux intervenants ne sont jamais comptabilisés comme revenu disponible de PROCHÉLIA.

## 5. Pilotage de la rentabilité

Tableau de bord minimum, segmenté par pays, devise, service, zone, canal, client B2B/B2C et cohorte :

- missions demandées, confirmées, terminées, annulées et contestées ;
- taux de conversion et taux de remplissage ;
- revenu plateforme HT et contribution totale ;
- contribution moyenne et distribution par mission ;
- coût d'acquisition client et délai de récupération ;
- fréquence de réachat et valeur vie client, avec hypothèses visibles ;
- taux d'acceptation et revenu net horaire estimé des intervenants ;
- coût du support, des incidents, des remboursements et des promotions ;
- délai moyen entre mission terminée, fonds disponibles et reversement ;
- trésorerie disponible, engagements, dettes envers intervenants et prévisions de cash-flow ;
- seuil de rentabilité et scénarios prudent, central et haut.

Les prévisions doivent distinguer données réelles, estimations et hypothèses. Les cohortes insuffisantes ne sont pas présentées comme des certitudes.

## 6. Règles d'autonomie de NEXUS SUPRA

NEXUS SUPRA peut analyser, détecter une marge insuffisante, simuler plusieurs tarifs, recommander une action et préparer un changement.

Il ne peut pas, sans autorisation humaine adaptée :
- modifier rétroactivement un prix accepté ou une rémunération ;
- déplacer des fonds, déclencher un paiement ou un remboursement ;
- changer une commission contractuelle ;
- activer une promotion qui fait passer une mission sous son plancher ;
- modifier les règles fiscales, juridiques ou de conformité.

Toute recommandation conserve les données d'entrée, la version de la règle, les hypothèses, l'impact attendu et le résultat constaté.

## 7. France, Algérie et expansion internationale

Les livres, devises, règles fiscales, facturation, PSP, KYC/LCB-FT, protection du consommateur, droit du travail/indépendance, assurances et transferts transfrontaliers doivent être paramétrés et validés pays par pays.

Ne jamais convertir implicitement des soldes EUR et DZD. Enregistrer devise, taux, source et horodatage de change. Aucun lancement dans un nouveau pays sans validation juridique, fiscale, bancaire, assurance et opérationnelle locale.

## 8. Tests d'acceptation obligatoires

- calcul exact en unités mineures, arrondis et taxes ;
- mission rentable, mission sous le plancher, marge nulle et marge négative ;
- frais PSP, remboursements partiels, annulation, litige et chargeback ;
- double soumission, rejeu webhook et idempotence ;
- concurrence sur le solde et réservation atomique ;
- isolation des portefeuilles et des missions entre intervenants ;
- changement de devise et taux de change périmé ;
- affichage cohérent du net intervenant et du coût client ;
- simulation de croissance, baisse de demande, hausse des coûts et choc de trésorerie ;
- audit des décisions automatisées et approbation humaine des actions sensibles.

## 9. Critères de mise en service

Aucun paiement réel et aucune promesse de rentabilité ne sont autorisés tant que le PSP réel n'a pas passé les tests Sandbox de bout en bout, les rapprochements financiers ne sont pas démontrés, les contrôles comptables et juridiques ne sont pas validés et le plan de trésorerie n'est pas approuvé.

La cible est une rentabilité durable et vérifiable, pas une promesse irréaliste de bénéfice garanti.
