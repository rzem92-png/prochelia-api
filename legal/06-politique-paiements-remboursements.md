# PROCHÉLIA — politique de paiement, frais et remboursements

**Version : 0.1 — BROUILLON À FAIRE VALIDER ET ALIGNER SUR LE PSP CONFIGURÉ**

## Prix et répartition
Le Client voit le prix total, les frais et taxes applicables avant confirmation. Les tarifs sont versionnés et la version appliquée est enregistrée avec la commande. La comptabilité distingue montant brut, frais PSP, commission PROCHÉLIA, rémunération de l'intervenant, taxes et remboursements selon le modèle contractuel validé.

## Prestataire de paiement
Les paiements sont traités par **[PSP exact et produit réellement activé]**. PROCHÉLIA ne stocke pas les numéros complets de carte ni les codes de sécurité. Les clés secrètes sont stockées dans le gestionnaire de secrets de l'environnement, jamais dans le dépôt ou le navigateur. Le mode test et la production sont séparés.

## Versements et rapprochement
Un versement n'est autorisé que si la transaction, la mission, l'identité et les conditions du PSP sont vérifiées. Les soldes, paiements, remboursements, frais et litiges doivent être rapprochés avec les références PSP et les événements signés. Une anomalie, un événement non résolu, un solde incohérent ou un litige bloque les opérations sensibles et déclenche une revue humaine.

## Remboursements et contestations
Le montant remboursé ne peut dépasser le montant encaissé net des remboursements antérieurs et doit respecter les conditions légales et contractuelles. Les remboursements partiels sont tracés. Les conséquences sur la rémunération d'un intervenant ne sont pas effectuées sans règles documentées et contrôle de cohérence; les écritures doivent être atomiques ou réconciliables, idempotentes et auditables.

## Champs à compléter
PSP et fonctionnalités réellement activées, frais, délais, politique d'annulation, règles de remboursement, facturation/TVA, litiges, contact et différences B2B/B2C. Faire valider avant publication.
