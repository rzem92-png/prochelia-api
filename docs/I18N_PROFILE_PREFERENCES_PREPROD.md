# PROCHÉLIA — Langue préférée du profil (préproduction)

**Statut : conception validable — aucune migration D1 appliquée, aucun déploiement.**

## Objectif

Synchroniser la préférence de langue de l’interface et la langue parlée Client/Intervenant depuis un profil authentifié, sans exposer les données de profil ni permettre à un utilisateur de modifier celui d’un autre.

## Constat du code actuel

- L’authentification repose sur le cookie de session `prochelia_session` et `getSessionUser()`.
- `/api/auth/me` renvoie actuellement un profil `safeUser` sans préférence linguistique.
- Le stockage linguistique UI actuel est local au navigateur. Il ne prouve pas que la préférence est persistée côté serveur.
- La table `users` est créée/administrée via le schéma D1 existant. Il faut auditer la définition réelle avant de choisir une migration; aucune colonne n’est présumée disponible.

## Contrat cible proposé

- `GET /api/profile/preferences`: session valide obligatoire; retourne uniquement les préférences du compte connecté.
- `PATCH /api/profile/preferences`: session valide obligatoire; accepte uniquement des champs allowlistés:
  - `ui_locale`: locale UI autorisée
  - `spoken_language`: langue parlée préférée autorisée
- Pas d’argument `user_id` fourni par le client. L’identité vient exclusivement de la session.
- Refuser les rôles/états de compte non autorisés selon le RBAC central.
- Valider JSON borné, types stricts, longueur et allowlist de codes BCP-47/ISO documentés.
- SQL paramétré uniquement; réponses `no-store`; erreurs non bavardes.
- Protection CSRF/CORS doit rester compatible avec le middleware global actuel.
- L’API ne doit pas prétendre traduire les messages ou la voix: la préférence n’est pas un service de traduction.

## Migration à proposer (non appliquée)

La migration doit être versionnée, testée en SQLite/D1 isolé, et approuvée avant exécution:
- ajouter une préférence UI nullable et une préférence de langue parlée nullable, ou choisir une table dédiée `user_preferences` si l’architecture de profil existante l’impose;
- définir les valeurs par défaut côté application (FR) plutôt que réécrire les comptes existants;
- conserver les préférences séparées Client/Intervenant si un compte peut cumuler des rôles;
- ne pas stocker les langues parlées dans les documents d’identité ou les données de vérification.

## Tests bloquants avant merge

1. Sans session: 401 et aucune requête de lecture/écriture profil.
2. Session expirée / utilisateur désactivé: refus.
3. Client A ne peut ni lire ni modifier Client B (IDOR).
4. Intervenant ne peut pas modifier les préférences d’un autre intervenant.
5. Locale non allowlistée, tableau, objet, payload oversized, JSON invalide: rejet.
6. Méthodes non autorisées: 405 avec `Allow`.
7. Injection SQL: impossible via paramètres.
8. DB indisponible/exception: erreur générique, pas de stack trace ni de données personnelles.
9. GET/HEAD ne modifient jamais les données.
10. Compatibilité navigateur: API indisponible => fallback local explicite, pas de fausse confirmation de synchronisation.

## Déploiement progressif

1. Migration D1 de préproduction uniquement, après sauvegarde et validation.
2. Tests API avec D1 de préproduction isolée.
3. Tests UI et vérification de synchronisation Client/Intervenant.
4. Test rollback de migration et restauration.
5. Validation RGPD (finalité, durée, droits d’accès, minimisation).
6. Approbation humaine avant toute migration ou publication en production.

## Limites linguistiques

La présence d’un code langue dans le catalogue n’implique pas la disponibilité d’une traduction fiable. Pour le Kabyle, Tarifit/Rifain, Darija, Wolof et autres langues, prévoir validation par locuteurs natifs. Traduction automatique et voix nécessitent un fournisseur, un consentement explicite, une politique de confidentialité, une conservation minimale et un affichage du texte original.
