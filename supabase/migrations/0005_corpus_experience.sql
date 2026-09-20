-- =====================================================================
-- JOBPILOT — Migration 0005 : corpus d'expérience et motif de rejet
--
-- Cette migration avait été appliquée directement dans l'éditeur SQL au
-- moment de l'étape 4ter, sans être versionnée : le dépôt sautait de 0004 à
-- 0006. Elle est reconstituée ici pour que l'historique soit complet — ce qui
-- devient indispensable maintenant qu'une sauvegarde peut être réimportée
-- dans un projet Supabase neuf.
--
-- Idempotente : peut être rejouée sans erreur sur une base où elle est déjà
-- passée.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LE CORPUS
--
-- La matière première de la reformulation et des missions proposées. Aucune
-- ligne n'arrive jamais sur un CV : le corpus autorise un terme et mesure ce
-- qui est récupérable. Il est cloisonné par expérience — ce qui a été fait
-- chez un employeur n'autorise rien dans la mission d'un autre.
-- ---------------------------------------------------------------------
create table if not exists public.corpus_experience (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid(),
  experience_id   uuid not null references public.experiences(id) on delete cascade,
  texte           text not null,
  activites_codes text[] not null default '{}',
  volets          text[],
  source          text,
  ordre           int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

create index if not exists idx_corpus_experience
  on public.corpus_experience(experience_id, ordre);

alter table public.corpus_experience enable row level security;
drop policy if exists proprietaire on public.corpus_experience;
create policy proprietaire on public.corpus_experience
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. LE MOTIF DE REJET D'UNE REFORMULATION
--
-- Une proposition écartée par le contrôle restait invisible : on ne savait
-- pas qu'elle avait existé, ni pourquoi elle avait été refusée. Le motif est
-- conservé pour être affiché, et pour qu'une proposition écartée à tort
-- puisse être acceptée à la main.
-- ---------------------------------------------------------------------
alter table public.mission_formulations
  add column if not exists motif_rejet text;
