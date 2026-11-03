# Audit de schéma — préférences linguistiques

Date: 2026-11-03  
Branche: `fix/nexus-minimum-viable-quote-gate`  
Mode: inspection GitHub du code uniquement, aucune connexion D1 et aucune écriture runtime.

## Faits confirmés dans `src/index.js`

- `safeUser(row)` renvoie uniquement id, role, email, prénom, nom, téléphone, status, dates.
- `getSessionUser()` joint `sessions` à `users`, vérifie l’expiration et l’état `active`, puis renvoie `safeUser(row)`.
- `/api/auth/me` renvoie le profil authentifié existant.
- La création initiale de compte écrit dans `users` (id, role, email, first_name, last_name, phone, status, password_hash).
- Le schéma runtime réel de D1 n’a pas été interrogé dans cette tâche. L’audit API existant `/api/core/schema` est conçu en lecture seule, mais n’a pas été exécuté ici.

## Décision technique

Ne pas ajouter des colonnes arbitraires à `users` et ne pas modifier `safeUser` en supposant que des champs de préférence existent. Une table dédiée `user_preferences` est probablement plus isolée, mais sa migration doit être alignée sur le mécanisme de migration et les contraintes FK déjà utilisées par le projet.

## Blocage avant implémentation runtime

Il faut récupérer le schéma D1 de préproduction via la procédure d’audit **lecture seule** et confirmer:
- identifiants / types exacts des tables users;
- FK et stratégie de suppression;
- migration versionnée et rollback disponibles;
- branchement du test D1 dans CI.

Sans ce constat, une implémentation endpoint pourrait passer les tests mocks et échouer sur la vraie D1, ou entraîner une migration non sûre.

## Prochaine séquence sûre

1. Audit D1 preview strictement lecture seule.
2. Préparer migration versionnée et rollback.
3. Tester migration sur une D1 jetable.
4. Développer endpoint avec session et allowlist.
5. Tests IDOR, validation payload, erreurs DB et CORS/CSRF.
6. Test UI sync en préproduction isolée.
7. Aucune production sans validation explicite.
