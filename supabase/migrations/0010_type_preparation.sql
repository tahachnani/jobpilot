-- =====================================================================
-- JOBPILOT — Migration 0010 : la fiche de préparation d'entretien (D70)
--
-- Le statut « Entretien » existait depuis l'étape 1 et ne déclenchait rien,
-- alors qu'à ce moment l'application détient tout : l'annonce, le CV
-- exactement tel qu'il est parti, la lettre, et surtout les écarts qu'elle a
-- elle-même mesurés entre le profil et le poste.
--
-- Une préparation n'est ni un CV ni une lettre : elle reçoit son propre type
-- pour ne pas écraser l'un d'eux à l'affichage.
--
-- `add value` doit être exécuté hors transaction : lance ce fichier seul dans
-- l'éditeur SQL, pas collé à la suite d'un autre.
-- =====================================================================

alter type type_document add value if not exists 'preparation';
