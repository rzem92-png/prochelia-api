# Nexus-SUPRA — ranking équitable et explicable (V1)

## Objectif
Classer les intervenants admissibles avec une approche multi-critères transparente, qui favorise l'adéquation réelle au besoin et réserve un signal modéré à la visibilité des petits professionnels locaux.

## Principes impératifs
- Éligibilité, vérification, disponibilité, compétences, distance et budget sont des **filtres bloquants**; aucun score ne peut les contourner.
- Pondération V1 : compétences 30 %, disponibilité 20 %, fiabilité 15 %, qualité 10 %, distance 10 %, équité tarifaire 10 %, visibilité équitable 5 %.
- Le signal visibilité est modeste et plafonné : il ne permet pas à un prestataire non vérifié ou non qualifié d'être classé.
- Pas de données sensibles ou d'inférence sensible; minimisation, explications par codes, audit de versions.
- Le module est déterministe et pur : pas de DB, pas de réseau, pas de paiement, pas d'affectation automatique.
- Ne pas exposer les données personnelles des autres prestataires au client; API doit ne retourner que le minimum utile.

## Évaluation avant mise en service
Offline replay sur jeux synthétiques puis données autorisées et minimisées; mesurer taux de mission réalisée, annulation, temps de réponse, satisfaction, disparités de visibilité, concentration de revenus, plaintes et impact client/intervenant. Versionner les poids, tests de dérive et rollback. Ne pas présenter ce score comme une preuve de qualité ou sécurité.

## Limites
V1 ne gère pas encore contraintes temporelles exactes, géocodage, travel time, multi-service scheduling, répétition/continuité, pénalités de cancellation, ni optimisation globale de portefeuille. Ces critères doivent être ajoutés après tests métier et revue privacy/fairness.
