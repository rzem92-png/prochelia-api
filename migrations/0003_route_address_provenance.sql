-- PROCHÉLIA V14.5.6 — adresses de référence pour le calcul d'itinéraire
-- Migration additive : les adresses existantes ne sont ni inventées ni modifiées.
-- Les devis avec déplacement restent bloqués tant que le profil intervenant
-- ne possède pas une adresse de départ complète et vérifiée.
ALTER TABLE intervenants ADD COLUMN base_address TEXT;
ALTER TABLE intervenants ADD COLUMN base_city TEXT;
ALTER TABLE intervenants ADD COLUMN base_postal_code TEXT;
