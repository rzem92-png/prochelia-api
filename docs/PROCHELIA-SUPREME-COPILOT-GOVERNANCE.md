# PROCHÉLIA SUPREME — gouvernance du Copilote transversal
Spécification cible de préproduction ; ne prouve pas que toutes les intégrations sont en service.

## Orchestrateur et spécialistes
Un orchestrateur unique coordonne des domaines spécialisés : stratégie/marché, finance/trésorerie, tarification/revenus, opérations/qualité, intervenants/confiance, juridique/vie privée, croissance/marketing, international/localisation, support/familles, sécurité/résilience. Une seule source de vérité métier et une seule couche d'autorisation s'appliquent à tous.

## Niveaux d'autonomie
L0 lecture/diagnostic. L1 préparation de brouillons et simulations. L2 actions internes réversibles à faible risque, limitées par permissions, budgets et idempotence. L3 approbation humaine obligatoire pour prix publiés, campagnes, contrats, remboursements, versements, accès aux données, décisions concernant une personne, activation de pays et changements de production. L4 validation d'un spécialiste externe compétent (juriste, expert-comptable, DPO, assureur, PSP ou conseil local).

L'IA ne peut jamais s'accorder elle-même une autorisation. Sa sortie reste une proposition non exécutable. Un service déterministe revérifie identité, rôle, périmètre, état métier, limites et approbation avant toute action.

## Résolution vérifiable
Détecter → qualifier → minimiser les données → distinguer faits/hypothèses → chiffrer l'impact client/intervenant/plateforme → proposer options/risques → obtenir approbation → exécuter via connecteur autorisé → vérifier reçu aval → rapprocher → notifier → clôturer uniquement avec preuve. Sans preuve, le dossier reste ouvert et escaladé.

## Garde-fous
Séparation des environnements ; aucun accès direct à la production par l'IA ; permissions par rôle/domaine/pays/montant/durée ; double validation au-dessus de seuils financiers ; plafonds de dépenses et quotas IA ; journal append-only sans données sensibles superflues ; défense contre prompt injection dans fichiers et messages ; données de santé exclues par défaut ; kill switch par agent/connecteur/pays ; recours humain ; tests de biais et adversariaux. Le modèle n'exécute jamais du SQL, du code ou des commandes libres.

## Pilotage
Mesurer résolution vérifiée, erreurs, faux positifs/négatifs, temps de résolution, coût IA, escalades, incidents et satisfaction. L'objectif est une autonomie utile et contrôlée, pas l'autonomie maximale. Commencer en lecture seule sur données fictives, puis brouillons, puis actions réversibles après tests. Les fonctions essentielles doivent continuer si le fournisseur IA est indisponible.
