# PROCHÉLIA — Référentiel financier V1

Statut : règle métier de référence à implémenter et tester. Périmètre : devis et missions B2C en premier ; B2B séparé.
Sécurité : cette spécification ne déclenche aucune migration, aucun paiement, aucune écriture D1 et aucun déploiement.

## 1. Principes non négociables
1. Une seule source serveur de vérité pour le catalogue, les tarifs et les politiques tarifaires.
2. Tous les montants sont calculés en centimes entiers, jamais en flottants monétaires.
3. Prix de prestation, déplacement, frais PSP, taxes et marge sont des composantes distinctes.
4. Une remise n'est applicable que si une promotion active, approuvée et datée l'autorise.
5. Les majorations dépendent des dates/heures réelles de mission et d'une politique versionnée.
6. Aucun devis n'est émis si le plancher intervenant, le plafond applicable ou la marge minimale ne sont pas respectés.
7. Chaque devis conserve un instantané des versions catalogue, tarif, promotion, règles, calcul et horodatage.
8. Les règles B2C et B2B ne sont jamais mélangées implicitement.

## 2. Modèle B2C de référence
- service_gross_cents : prix de prestation après majorations et remises autorisées, hors déplacement.
- commission_rate_bps : taux de commission en points de base (1 % = 100 bps).
- commission_cents : arrondi déterministe de service_gross_cents × commission_rate_bps / 10000.
- provider_payout_cents : service_gross_cents − commission_cents.
- travel_client_cents : déplacement facturé au client selon une règle documentée.
- travel_provider_cost_cents : coût/remboursement réellement dû à l'intervenant, distinct du montant facturé.
- client_total_cents : prestation + déplacement client + autres frais explicitement autorisés.
- psp_fee_cents : frais de paiement estimés/réels selon le contrat PSP.
- platform_other_variable_costs_cents : autres coûts variables attribuables à la mission.
- platform_contribution_cents : commission + déplacement facturé − coût déplacement intervenant − frais PSP − autres coûts variables.

Le plancher de rémunération est un contrôle, pas une seconde formule de paiement. Si la rémunération est inférieure au minimum, le devis est bloqué ou soumis à une règle explicitement approuvée. Ne jamais augmenter silencieusement le prix ni diminuer la commission pour masquer l'écart. Toute exception doit être explicite, versionnée, autorisée et auditée.

La marge minimale cible s'applique à la contribution plateforme après coûts variables connus. Les coûts fixes et impôts sur le résultat sont suivis dans les états financiers et ne doivent pas être présentés comme marge mission nette.

## 3. Contrôles réglementaires et fiscaux
- Le plafond réglementaire applicable doit être configuré par prestation, territoire, date d'effet et base juridique vérifiée.
- La règle indiquant si le déplacement entre dans le plafond doit être définie explicitement par catégorie ; à défaut, le devis est bloqué pour revue.
- TVA, exonérations, frais refacturés et régime fiscal sont modélisés séparément et validés par conseil comptable/juridique. Aucun taux fiscal n'est présumé.
- Les promotions ne contournent ni plancher intervenant, ni obligation fiscale, ni plafond réglementaire.
- Toute modification tarifaire est datée, versionnée et non rétroactive sur un devis accepté, sauf fondement contractuel vérifié.

## 4. B2B — règles distinctes
Le B2B utilise une politique dédiée : contrat-cadre, prix négocié, volume, facturation périodique, délais de paiement, éventuels frais de gestion. Il ne réutilise pas automatiquement le taux B2C. Chaque contrat définit sa base de calcul, ses coûts, ses taxes, son plafond éventuel et sa marge cible.

## 5. Ordre de calcul canonique
1. Vérifier que la prestation est active et autorisée dans le catalogue serveur.
2. Charger la version tarifaire applicable à la date et au territoire de mission.
3. Calculer le prix de base.
4. Appliquer les majorations autorisées selon les dates/heures réelles.
5. Appliquer uniquement les promotions validées et compatibles.
6. Calculer séparément déplacement client et coût déplacement intervenant.
7. Calculer commission et rémunération intervenant.
8. Vérifier plancher intervenant et plafond réglementaire.
9. Déduire frais PSP et autres coûts variables connus.
10. Vérifier marge minimale et cohérence comptable.
11. Produire un devis immuable avec détail, versions et expiration.
12. À l'acceptation, revérifier validité, disponibilité, politique et montant ; ne jamais recalculer silencieusement un devis accepté.

## 6. Tests d'acceptation obligatoires
- Commission : taux en bps et arrondi déterministe au centime.
- Rémunération : prestation moins commission, jamais négative.
- Plancher : devis refusé si rémunération inférieure au minimum.
- Déplacement : facturation client et coût intervenant séparés ; aucun double comptage.
- PSP : déduit une seule fois de la contribution plateforme.
- Promotion : refusée si non approuvée, expirée, non applicable ou cumul interdit.
- Majorations : calculées à partir des dates/heures réelles et de la version applicable.
- Plafond : refus en l'absence de règle déterminée sur l'inclusion du déplacement.
- Marge : devis refusé si contribution sous le seuil.
- B2B : n'utilise pas la politique B2C par défaut.
- Idempotence : répétition d'une demande ne crée pas de doublon ni de montant différent.
- Arrondis : résultats identiques sur tous les clients et environnements.
- Audit : chaque composante est retraçable sans données personnelles dans les journaux.

## 7. Conditions avant activation
Traduire ce référentiel en fonctions pures testées, le comparer au moteur existant, puis le relier à une seule source de catalogue et de politique tarifaire. Identifier les écarts historiques avant toute bascule. Aucun backfill ou changement de schéma avant revue des migrations, sauvegarde vérifiée et test de restauration sur base isolée.

## 8. Hors périmètre
Cette approbation valide l'orientation métier proposée, pas un avis juridique/fiscal, pas un contrat intervenant, pas un tarif commercial définitif, pas un paiement, pas une migration et pas une autorisation de production.