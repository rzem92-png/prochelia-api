# PROCHÉLIA — matrice de conservation, archivage et purge RGPD

**Version 1.0 — POLITIQUE DE TRAVAIL À VALIDER AVANT PRODUCTION.** Cette matrice est un socle opérationnel, pas un avis juridique définitif. Le responsable de traitement doit confirmer les finalités, bases légales, obligations sectorielles, contrats, délais de prescription et règles applicables à chaque service de PROCHÉLIA. Aucun délai ne doit être activé en production tant que le propriétaire métier et le fondement de conservation ne sont pas validés.

## 1. Règles non négociables

1. Pas d'archivage « infini » des données personnelles. Chaque catégorie a une finalité, une base légale, un point de départ, une durée et une action de fin.
2. Séparer la base active, l'archive intermédiaire à accès restreint et les archives légalement obligatoires. L'archivage intermédiaire n'est pas systématique : il doit répondre à une obligation ou à un besoin probatoire précisément documenté.
3. Conserver uniquement les champs nécessaires à la finalité d'archive. Les données de santé, les pièces d'identité et les justificatifs complets ne doivent pas être conservés « au cas où ».
4. À l'échéance : supprimer, anonymiser de façon irréversible, ou prolonger uniquement sur un fondement documenté (obligation légale, contentieux, gel légal). Une suspension de purge doit être ciblée, motivée, datée, approuvée et réévaluée.
5. Restreindre les archives aux personnes habilitées, tracer les consultations et extractions, chiffrer les supports et contrôler l'intégrité.
6. Toute demande d'effacement doit être propagée aux systèmes actifs, aux copies exportées et aux sous-traitants lorsque le droit s'applique. Une exception légale doit être documentée par catégorie, pas opposée globalement.
7. Les sauvegardes sont un filet de reprise après incident, pas une archive métier consultable. Les restaurations doivent rejouer le registre des suppressions/rectifications depuis la sauvegarde afin de ne pas faire réapparaître les données à effacer.
8. Aucun effacement automatique irréversible ne doit être activé tant que le mapping des tables, la preuve d'exécution, les dépendances, les obligations comptables et les tests de restauration ne sont pas validés.

## 2. Matrice initiale proposée

Les durées ci-dessous sont des **valeurs de travail à confirmer** en fonction du rôle exact de PROCHÉLIA et des obligations réellement applicables.

| Catégorie | Base active | Archive intermédiaire | Fin de cycle |
|---|---|---|---|
| Compte client et coordonnées | Durée d'utilisation du compte et des missions en cours | Seulement les éléments nécessaires à une obligation ou à un litige, avec accès restreint et point de départ documenté | Supprimer/anonymiser les champs non nécessaires à la clôture; ne pas garder un compte inactif indéfiniment |
| Prospects et demandes sans contrat | Le temps de traiter la demande | Pour prospection commerciale : en principe jusqu'à 3 ans après collecte ou dernier contact actif, si la finalité et la base légale le permettent | Suppression ou anonymisation; liste d'opposition minimale séparée si nécessaire |
| Missions et preuve de prestation | Pendant exécution, support et règlement de la mission | Seulement les éléments nécessaires à une réclamation, une prescription ou une obligation; durée déterminée après validation juridique | Supprimer les données opérationnelles inutiles; conserver séparément les seules preuves nécessaires |
| Factures et pièces comptables | Accès opérationnel pendant le cycle de facturation | Archive comptable restreinte jusqu'à 10 ans lorsque l'obligation applicable le requiert | Suppression sécurisée à la fin du délai, sauf litige ou obligation distincte documentée |
| Paiements et rapprochements PSP | Pendant paiement, rapprochement et traitement des anomalies | Écritures nécessaires à la comptabilité, aux obligations légales et à la défense de droits, séparées des accès opérationnels | Purger les données de carte/secrets non nécessaires; ne jamais stocker les données carte sensibles si le PSP les gère |
| Documents d'identité et vérifications | Pendant la vérification et tant que l'accès au service le justifie | Conserver de préférence le statut, la date, le vérificateur et la référence de preuve; conserver une copie uniquement si un texte ou un besoin précis le justifie | Supprimer la copie dès qu'elle n'est plus nécessaire, sous réserve d'une obligation documentée |
| Qualifications, assurances et autres pièces intervenant | Pendant validité et relation active | Statut de vérification, périmètre, dates et preuve minimale si nécessaire à une obligation ou à un litige | Supprimer les pièces expirées/inutiles; conserver le minimum probatoire uniquement si justifié |
| Messages et support | Le temps de résolution | Extraits strictement nécessaires à une réclamation ou à un contentieux, avec accès limité | Purger le reste; ne pas archiver tous les échanges par défaut |
| Journaux de sécurité et d'accès | Exploitation et détection d'incidents | Durée glissante de 6 à 12 mois comme point de départ, sauf besoin documenté (incident, contrôle ou litige) justifiant une durée différente | Purge automatique et auditée; exclure mots de passe, tokens, secrets et contenu inutile |
| Consentements, versions contractuelles et preuve d'acceptation | Pendant la relation et les besoins de preuve | Version exacte, empreinte, horodatage et preuve minimale pendant la durée nécessaire à la preuve d'obligations ou droits | Purger à la fin du délai applicable; ne pas conserver d'autres données que celles nécessaires à la preuve |
| Demandes RGPD | Le temps de traitement de la demande | Journal minimal nécessaire à démontrer le traitement et gérer une contestation, avec durée validée par le responsable | Supprimer le contenu de la demande devenu inutile; garder uniquement la preuve minimale justifiée |
| Cookies et traceurs | Selon finalité et choix de la personne | Conserver le choix/consentement uniquement pour démontrer le respect des choix, selon une durée validée | Renouveler le consentement lorsque requis; ne pas conserver des identifiants de suivi sans limite |
| Sauvegardes techniques D1/R2 | Cycle de reprise après sinistre | Politique de rotation proposée : 35 à 90 jours maximum, à fixer selon RPO/RTO et capacité; accès d'administration restreint | Expiration automatique vérifiée; restauration suivie de la réapplication des suppressions et rectifications |
| Exports manuels et fichiers temporaires | Uniquement pour la tâche qui les nécessite | Aucun archivage par défaut; exception approuvée avec responsable, finalité et échéance | Suppression rapide et contrôlée après usage |
| Données statistiques | Tant que l'analyse le justifie | Privilégier l'anonymisation irréversible avant conservation longue | Ne qualifier d'anonymes que les données non raisonnablement ré-identifiables; la pseudonymisation reste soumise au RGPD |

## 3. Gouvernance et rôles

- **Responsable de traitement** : valide les finalités, bases légales, durées, exceptions et décisions de purge.
- **Administratrice/Gérante** : peut consulter l'état de conformité et les preuves d'exécution selon une habilitation dédiée; le rôle ne doit pas donner accès au contenu des archives par défaut.
- **Technique** : exécute les règles approuvées, fournit journaux et rapports, et ne décide pas seul d'une durée légale.
- **Sous-traitants** : leurs contrats doivent préciser assistance, suppression/restitution en fin de prestation, sauvegardes, sous-traitants ultérieurs et incidents.
- **Gel de conservation** : doit préciser le dossier, les catégories concernées, le motif, l'autorité approbatrice, la date de révision et la levée. Il ne suspend pas les autres purges.

## 4. Procédure de purge et de preuve

1. Identifier la catégorie et la finalité à partir d'un registre versionné.
2. Calculer l'échéance à partir d'un événement métier fiable (clôture de compte, fin de mission, dernier contact, date de facture, fin de validité).
3. Exclure les éléments sous obligation légale ou gel validé, uniquement pour les champs concernés.
4. Générer d'abord un rapport « dry-run » : nombre d'éléments, tables, raisons, erreurs et exceptions, sans supprimer.
5. Faire valider le rapport par une personne habilitée et exécuter la purge sélective après recette.
6. Journaliser la règle/version, le lot, l'horodatage, le résultat, les erreurs et un identifiant de preuve non excessif; ne pas copier le contenu supprimé dans les logs.
7. Contrôler l'effectivité de la suppression dans la base, les index, les fichiers R2, les caches et les sous-traitants concernés.
8. En cas de restauration, réappliquer le registre de suppression/rectification avant de rouvrir le système aux utilisateurs.
9. Vérifier mensuellement les exceptions et trimestriellement les durées et l'exécution des purges; tester périodiquement une restauration isolée.

## 5. Sauvegarde et archivage : distinction obligatoire

- **Sauvegarde** : copie technique chiffrée pour reprise après incident; rotation bornée et restauration testée.
- **Archive intermédiaire** : données sélectionnées, séparées/logiquement isolées, accès exceptionnel et motif juridique ou probatoire précis.
- **Archive comptable** : documents imposés par une durée légale, accès restreint et suppression à l'échéance.
- **Archivage longue durée** : n'est pas une autorisation générale de conserver des données personnelles sans limite.

La sauvegarde logique D1/R2 actuellement présente dans le code doit être considérée comme **non validée en exploitation** jusqu'à la configuration effective du bucket et du secret, à l'activation vérifiée du Cron, à un test de restauration et à la mise en œuvre du mécanisme de non-réapparition des données supprimées. Le paramètre actuel de 90 jours est un paramètre de configuration, pas la preuve d'une expiration effective des objets R2.

## 6. Points à valider avant activation

- Identité juridique, rôles responsable/sous-traitant et finalités réelles par flux.
- Délais comptables, fiscaux, contractuels et contentieux applicables à chaque document.
- Schéma D1 réel, stockage R2 et liens entre utilisateurs, missions, documents, paiements et factures.
- Politique d'expiration R2 effectivement configurée et vérifiée.
- Procédure de droits RGPD, de suppression et de restauration testée de bout en bout.
- Information transparente des clients et intervenants sur les durées par catégorie.
- Analyse d'impact si les traitements, la surveillance, la localisation ou la vulnérabilité des personnes le rendent nécessaire.

## 7. Références officielles de travail

- CNIL, « Les durées de conservation des données » : https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees
- CNIL, « Comment concilier les durées de conservation et les archives ? » : https://www.cnil.fr/fr/comment-concilier-les-durees-de-conservation-et-les-archives
- CNIL, « Minimiser les données collectées » : https://www.cnil.fr/fr/minimiser-les-donnees-collectees
- CNIL, « Sécurité : tracer les opérations » : https://www.cnil.fr/fr/securite-tracer-les-operations
- Service-Public Entreprendre, « Tout savoir sur la facturation » : https://entreprendre.service-public.gouv.fr/vosdroits/F23208

**Statut de conformité :** la présence de cette matrice ne constitue pas, à elle seule, une conformité RGPD. Elle doit être approuvée, reliée aux traitements réellement exécutés, appliquée techniquement et contrôlée périodiquement.
