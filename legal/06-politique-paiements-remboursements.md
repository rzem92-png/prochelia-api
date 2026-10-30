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


## Paiements internationaux et multi-devises
Un pays ou une devise est activé uniquement après confirmation de l'éligibilité du compte plateforme, du pays du bénéficiaire du versement, du type de flux, du produit PSP et des obligations KYC/AML. Le système conserve la devise de commande, la devise de règlement, le taux de conversion, sa source et son heure, les frais de change et le montant final. Client et intervenant voient les montants les concernant avant confirmation. Aucune conversion silencieuse ni marge de change non annoncée n'est permise.

## Comptabilité et rapprochement
Les montants sont stockés en unités mineures entières avec code ISO de devise. Les soldes de devises différentes ne sont jamais additionnés comme s'il s'agissait d'une même monnaie. Le grand livre est append-only et idempotent. Chaque transaction, frais, commission, remboursement, réserve, versement et conversion est rapproché au relevé PSP et au compte bancaire correspondant. Les écarts, webhooks inconnus, soldes négatifs et versements bloqués déclenchent une revue et empêchent la clôture automatique.

## Paiements familiaux et tiers payeurs
Un proche, une entreprise ou un organisme ne peut payer pour un bénéficiaire que si le parcours identifie clairement le payeur, le bénéficiaire, le destinataire de la facture, le mandat requis et la personne autorisée à modifier/annuler la commande. Le paiement par un tiers ne donne pas automatiquement accès aux informations privées du bénéficiaire.

## Interdiction d'activation implicite
Un mode de paiement, pays, portefeuille ou versement international demeure désactivé tant que le PSP, la conformité, les tests de remboursement/litige et la comptabilité ne sont pas validés. Les clés de production ne sont jamais utilisées dans les tests.
