# PROCHÉLIA — checklist conformité bloquante avant production

## Identité et contrats
- [ ] Identité juridique complète et mentions légales vérifiées.
- [ ] Rôle réel de PROCHÉLIA déterminé par service et documenté (qui contracte, fixe le prix, choisit/contrôle l'intervenant, facture, encaisse et traite les réclamations).
- [ ] Conditions B2C, conditions B2B, charte intervenant, annulation/rétractation et médiation si requise complétées et contrôlées. Une validation par avocat n'est pas une obligation générale pour chaque document, mais une revue ciblée est fortement recommandée sur les risques de qualification, consommation, travail/plateformes et services à la personne.
- [ ] Assurances, qualifications et limites de prestation confirmées.
- [ ] Tarifs, frais, TVA, factures et remboursements alignés sur le fonctionnement réel.
- [ ] Version exacte des documents, empreinte, signataire et preuve d'acceptation testés.

## RGPD
- [ ] Registre des traitements et bases légales par finalité.
- [ ] Notice de confidentialité complète; durées de conservation définies et expliquées aux personnes.
- [ ] Matrice `10-matrice-conservation-archivage-purge-rgpd.md` validée catégorie par catégorie par le responsable de traitement.
- [ ] Rôles responsable/sous-traitant définis traitement par traitement.
- [ ] Annexe article 28 et liste des sous-traitants si applicables.
- [ ] Transferts hors EEE documentés et garanties vérifiées.
- [ ] Procédures de droits, suppression, export et réponse aux violations testées.
- [ ] Purge sélective testée en dry-run puis en préproduction; preuve de suppression conservée sans recopier les données supprimées.
- [ ] Procédure de restauration réappliquant les suppressions/rectifications postérieures à la sauvegarde testée.
- [ ] Archivage intermédiaire limité aux données nécessaires, justifié, séparé et à accès restreint; aucune conservation personnelle indéfinie par défaut.
- [ ] AIPD évaluée si le traitement présente un risque élevé.
- [ ] Minimisation des données sensibles, particulièrement les informations de santé et bénéficiaires vulnérables.

## Sécurité technique
- [ ] MFA/permissions minimales pour l'administration, révocation et rotation des secrets.
- [ ] Téléversements : limites, vérification de signature, hash, stockage privé, antivirus avec résultat CLEAN et hash identique avant revue/téléchargement.
- [ ] Antivirus en quarantaine si absent, erreur, délai dépassé, fichier non scannable ou hash différent.
- [ ] Mises à jour de dépendances et images, scans de vulnérabilités, procédure de correction.
- [ ] WAF/rate limit, CORS, protection contre abus, journaux sans secrets ni données inutiles.
- [ ] Binding R2, secrets de chiffrement et Cron de sauvegarde configurés dans l'environnement cible.
- [ ] Expiration/rotation R2 vérifiée, sauvegardes chiffrées et restauration testée de bout en bout.
- [ ] Reprise après sinistre testée sans réintroduire les données supprimées.
- [ ] Gestion d'incident et notification RGPD exercées.

## Paiements
- [ ] Environnement de test distinct de la production.
- [ ] Webhooks signés, idempotence, événements rejoués, montants et devises vérifiés.
- [ ] Remboursements partiels/concurrents, litiges et solde négatif testés.
- [ ] Rapprochement PSP/grand livre, gel des versements en cas d'anomalie.
- [ ] KYC/conditions PSP pour les intervenants et statut réel des versements vérifiés.

## Exploitation et acceptation
- [ ] Parcours B2C, B2B, intervenant et Gérante testés sur mobile et ordinateur.
- [ ] Scénarios d'échec et reprise sur erreur testés.
- [ ] Aucun plan IA ne peut déclencher directement un paiement, une suppression ou une décision juridique.
- [ ] Les actions sensibles ont validation humaine, idempotence, preuve d'exécution et journal d'audit.
- [ ] Pas de mise en production tant qu'un blocage critique reste ouvert.
