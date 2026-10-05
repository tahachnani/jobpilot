-- =====================================================================
-- JOBPILOT — Migration 0002 : durée d'ancienneté forcée
--
-- Nécessaire pour les expériences regroupées sur une seule ligne alors que
-- les périodes réelles ne sont pas continues (décision D14 : cabinets
-- Amouri / Ficomek, juin 2019 puis juin-août 2022).
-- Sans cette colonne, le calcul date_debut → date_fin annoncerait 38 mois
-- au lieu des 4 mois réellement travaillés.
-- =====================================================================

alter table public.experiences
  add column if not exists duree_mois_forcee int;

alter table public.experiences
  drop constraint if exists duree_forcee_positive;

alter table public.experiences
  add constraint duree_forcee_positive
  check (duree_mois_forcee is null or duree_mois_forcee > 0);

comment on column public.experiences.duree_mois_forcee is
  'Ancienneté en mois imposée manuellement, pour les expériences regroupées dont les périodes ne sont pas continues. Null = calcul automatique depuis les dates.';
