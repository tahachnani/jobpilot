-- =====================================================================
-- JOBPILOT — Migration 0009 : marché caché (D69)
--
-- La page « Marché caché » est annoncée dans le menu depuis l'étape 1, avec
-- un badge « V1.1 », et n'a jamais rien contenu. Une porte entrouverte depuis
-- un mois vaut mieux ouverte ou fermée : on l'ouvre.
--
-- Le marché caché, ici, ce sont les entreprises qu'on vise sans qu'elles
-- publient d'annonce. La table ne prétend pas à un annuaire : elle tient la
-- liste que Taha constitue lui-même, avec l'état de sa démarche. C'est le
-- pendant de `offres` pour les candidatures spontanées.
--
-- Idempotente.
-- =====================================================================

do $$ begin
  create type demarche_cible as enum (
    'a_qualifier', 'a_contacter', 'contactee', 'relancee', 'en_discussion',
    'sans_suite', 'ecartee'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.entreprises_cibles (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid(),
  volet          volet not null,
  nom            text not null,
  secteur_code   text,
  taille         text,
  localisation   text,
  site_web       text,
  contact_nom    text,
  contact_role   text,
  contact_email  text,
  pourquoi       text,
  demarche       demarche_cible not null default 'a_qualifier',
  date_contact   date,
  relance_prevue_le date,
  notes          text,
  ordre          int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

create index if not exists idx_cibles_volet
  on public.entreprises_cibles(volet, demarche);

alter table public.entreprises_cibles enable row level security;
drop policy if exists proprietaire on public.entreprises_cibles;
create policy proprietaire on public.entreprises_cibles
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Le déclencheur d'horodatage de la migration 0001 ne couvre que les tables
-- qui existaient alors.
drop trigger if exists trg_touch_entreprises_cibles on public.entreprises_cibles;
create trigger trg_touch_entreprises_cibles
  before update on public.entreprises_cibles
  for each row execute function public.touch_updated_at();
