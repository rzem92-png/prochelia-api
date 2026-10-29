# PROCHÉLIA — Passeport de confiance et admissibilité des missions

**Version 1.0 — spécification de préproduction — 29 octobre 2026**  
**Statut : spécification à implémenter et tester. Ce document ne prouve pas que les contrôles sont déjà actifs dans l'application.**

## 1. Objectif

Permettre au client de comprendre exactement ce qui a été contrôlé pour un intervenant et empêcher la réservation d'une prestation si les exigences définies pour cette prestation ne sont pas satisfaites.

Le Passeport de confiance ne constitue pas une certification générale de la personne, une garantie d'absence de risque, ni une preuve de compétence dans toutes les activités.

## 2. Statuts distincts

Ne jamais fusionner les statuts ci-dessous en un badge générique « vérifié ».

- `IDENTITY_VERIFIED` : contrôle d'identité effectué selon une procédure documentée, avec date et opérateur du contrôle.
- `DOCUMENT_RECEIVED` : document déposé, non encore validé.
- `DOCUMENT_REVIEW_PENDING` : document en attente de revue.
- `DOCUMENT_VERIFIED` : document contrôlé pour un objectif précis; enregistrer type, émetteur apparent, validité, périmètre et date de contrôle.
- `QUALIFICATION_VERIFIED` : qualification contrôlée pour une activité définie. Ce statut ne s'applique jamais à toutes les prestations par défaut.
- `EXPERIENCE_DECLARED` : expérience déclarée par l'intervenant sans preuve indépendante suffisante.
- `EXPERIENCE_EVIDENCED` : éléments justificatifs examinés. Ne pas présenter cela comme un diplôme ou une habilitation.
- `EXPIRED`, `SUSPENDED`, `REJECTED` : statut bloquant pour les missions qui nécessitent la vérification concernée.
- `NOT_REQUIRED_FOR_TASK` : exigence non requise pour la prestation concernée après validation du référentiel; ne signifie pas « vérifié ».

Chaque vérification conserve au minimum : identifiant de l'intervenant, catégorie, portée (activité/mission), statut, référence de la preuve en stockage privé, empreinte si appropriée, contrôleur, horodatage, date d'expiration éventuelle, motif de rejet/suspension et journal des transitions.

Ne pas stocker de copies de pièces d'identité ou d'informations sensibles dans les journaux d'audit. Le journal doit référencer les objets privés avec un identifiant interne.

## 3. Référentiel d'admissibilité par prestation

Chaque prestation doit avoir une configuration versionnée maintenue par la Gérante et validée avant activation :

- `service_code` et description exacte de la tâche;
- mode contractuel activé (indépendant, mandataire, autre mode autorisé);
- exigences légales ou réglementaires confirmées;
- qualifications, autorisations, assurances et documents obligatoires;
- exigences de contrôle d'identité et de vérification;
- exclusions et limites de mission;
- version du référentiel, date d'entrée en vigueur, validateur et preuve de revue;
- statut `DRAFT`, `ACTIVE`, `SUSPENDED` ou `RETIRED`.

Une prestation ne peut pas devenir `ACTIVE` si les exigences juridiques et opérationnelles ne sont pas renseignées et validées. Les catégories incertaines restent désactivées jusqu'à examen.

## 4. Décision d'admissibilité

Le serveur doit exécuter un contrôle déterministe avant la réservation et le répéter au démarrage de la mission. Le client ne peut pas contourner ce contrôle en cochant une décharge ou en choisissant un profil.

La décision doit tenir compte de :
1. la prestation exacte et sa version de référentiel;
2. le statut et le mode contractuel réellement disponibles;
3. l'identité et le statut du compte intervenant;
4. les vérifications requises, leur portée et leur validité à la date de mission;
5. les qualifications/autorisation/assurances obligatoires;
6. les suspensions et incidents qui bloquent l'activité;
7. les disponibilités et règles opérationnelles applicables.

Résultat attendu : `ELIGIBLE` ou `BLOCKED`, avec codes de motif explicites côté serveur. Les messages publics doivent rester compréhensibles sans révéler les détails sensibles de contrôle ou des données de tiers.

Aucun résultat `ELIGIBLE` ne doit être dérivé uniquement d'un champ fourni par le navigateur, d'un badge visuel, d'une note client ou de la déclaration de l'intervenant.

## 5. Présentation au client

Afficher séparément :
- identité contrôlée ou non;
- qualification précise contrôlée pour le service concerné;
- documents nécessaires contrôlés et leur statut à jour;
- expérience déclarée ou justifiée, sans confusion avec une qualification;
- limites et date du dernier contrôle lorsque pertinent;
- rôle contractuel de PROCHÉLIA et de l'intervenant pour la réservation;
- contenu, prix total, frais et conditions de la prestation.

Ne jamais afficher « certifié PROCHÉLIA », « sans risque », « garanti conforme » ou une formule équivalente sans base réelle et vérifiée. Une acceptation du client ne remplace pas une qualification ou une autorisation obligatoire.

## 6. Expiration, suspension et recours

- Une vérification expirée passe à un statut bloquant pour les missions concernées.
- Une modification d'un document invalide l'approbation associée à l'ancienne empreinte.
- Un document en quarantaine, infecté, illisible ou dont le scan ne confirme pas l'empreinte ne peut pas être approuvé.
- Une suspension conserve la trace de l'auteur, de l'heure, du motif codé et du périmètre concerné.
- Prévoir une procédure de contestation et de correction des erreurs.
- Révoquer les accès et les sessions en cas de suspension du compte lorsque cela est nécessaire.
- Ne pas effacer les preuves de sécurité obligatoires; appliquer une politique de conservation définie et proportionnée.

## 7. Protection des données et accès

- Accès aux pièces limité aux rôles et dossiers qui en ont besoin.
- Documents stockés en privé; aucune URL publique permanente.
- Les journaux ne contiennent ni mot de passe, ni jeton, ni contenu intégral de pièce, ni données de santé inutiles.
- Définir la base légale, la finalité, les destinataires et la durée de conservation par type de vérification.
- Évaluer les obligations RGPD, notamment une AIPD si le traitement est susceptible d'engendrer un risque élevé.
- Toute consultation administrative sensible doit être traçable; toute exportation doit être limitée et justifiée.

## 8. Tests d'acceptation bloquants

1. Profil sans identité contrôlée : bloqué lorsque l'identité est requise.
2. Qualification requise absente : mission bloquée même si le client coche « j'accepte ».
3. Qualification valide pour le service A, non pertinente pour le service B : admissible seulement pour A.
4. Document expiré : bloqué pour les prestations qui le requièrent.
5. Document remplacé et empreinte différente : ancienne vérification invalidée.
6. Analyse antivirus absente, en erreur, infectée ou empreinte divergente : document maintenu en quarantaine.
7. Compte suspendu : réservation et démarrage refusés côté serveur.
8. Modification du profil côté navigateur : aucun effet sur la décision serveur.
9. Profil expérience déclarée : ne reçoit jamais implicitement le statut de qualification vérifiée.
10. Référentiel de prestation absent, brouillon ou suspendu : réservation bloquée.
11. Tentative d'accès à une pièce par un autre utilisateur : refusée et journalisée.
12. Changement de statut : auteur, date, ancien statut, nouveau statut et motif traçables.
13. Le client voit les limites de vérification avant la commande et la version de l'information présentée est conservée.
14. Tous les scénarios de blocage ont des tests automatiques reproductibles; aucune anomalie critique ouverte n'est acceptée pour le pilote.

## 9. Périmètre MVP recommandé

Pour limiter les coûts, commencer par :
- un référentiel très réduit de prestations non médicales;
- les statuts de vérification et d'expiration;
- un écran administratif de revue et de suspension;
- le contrôle serveur avant réservation;
- un affichage client clair;
- un journal d'audit;
- des tests automatisés sur les cas de refus.

Ne pas commencer par un score IA de confiance. Le premier système doit être déterministe, explicable, contestable et auditable.

## 10. Conditions de mise en service

Cette spécification ne doit être déclarée opérationnelle qu'après :
- implémentation dans le code et les migrations;
- revue des autorisations et de l'isolation des données;
- tests automatisés et tests d'intégration D1;
- tests de documents expirés, modifiés, infectés et suspendus;
- revue juridique du catalogue de prestations et des obligations applicables;
- vérification que l'interface n'affiche aucune promesse supérieure aux contrôles réels.

Aucune fusion ni aucun déploiement ne découle de ce document.
