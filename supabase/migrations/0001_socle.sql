-- =====================================================================
-- JOBPILOT — Migration 0001 : socle complet
-- Conforme à la spécification V1.1, §4
-- Idempotente : peut être rejouée sans erreur.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TYPES ÉNUMÉRÉS
-- ---------------------------------------------------------------------
do $$ begin
  create type volet as enum ('cdg', 'compta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type type_contrat as enum ('cdi','cdd','alternance','stage','interim','freelance','autre');
exception when duplicate_object then null; end $$;

do $$ begin
  create type statut_offre as enum ('enregistree','analysee','cv_genere','lettre_generee',
                                    'email_genere','envoyee','entretien','refusee',
                                    'sans_reponse','cloturee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type criticite as enum ('indispensable','souhaitee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type categorie_comp as enum ('outil','cdg','compta','transversale','langue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type statut_extraction as enum ('complet','partiel','echec');
exception when duplicate_object then null; end $$;

do $$ begin
  create type type_document as enum ('cv','lettre','email');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. FONCTION updated_at
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. BLOC IDENTITÉ ET BASE PROFESSIONNELLE
-- ---------------------------------------------------------------------

create table if not exists public.profil (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid(),
  nom          text,
  prenom       text,
  email        text,
  telephone    text,
  localisation text,
  linkedin     text,
  permis       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

create table if not exists public.experiences (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid(),
  entreprise     text not null,
  ville          text,
  pays           text,
  date_debut     date not null,
  date_fin       date,                         -- null = poste en cours
  type_contrat   type_contrat not null,
  secteur_code   text,
  titre_cdg      text,
  titre_compta   text,
  visible_cdg    boolean not null default true,
  visible_compta boolean not null default true,
  ordre          int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz,
  constraint dates_coherentes check (date_fin is null or date_fin >= date_debut)
);

create table if not exists public.missions (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid(),
  experience_id    uuid not null references public.experiences(id) on delete cascade,
  texte_source     text not null,              -- verbatim du CV, JAMAIS modifié
  activites_codes  text[] not null default '{}',
  contient_chiffre boolean not null default false,
  pertinence_cdg   int not null default 0,
  pertinence_compta int not null default 0,
  ordre            int not null default 0,
  actif            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz,
  constraint pertinence_cdg_bornee    check (pertinence_cdg between 0 and 3),
  constraint pertinence_compta_bornee check (pertinence_compta between 0 and 3)
);

create index if not exists idx_missions_experience on public.missions(experience_id);

create table if not exists public.mission_formulations (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  volet      volet not null,
  texte      text not null,
  longueur   int generated always as (length(texte)) stored,
  origine    text not null,                    -- 'cv_original' | 'ia_reformulee'
  validee    boolean not null default false,   -- RÈGLE D'OR (D9)
  offre_id   uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint origine_connue check (origine in ('cv_original','ia_reformulee'))
);

create index if not exists idx_formulations_mission on public.mission_formulations(mission_id, volet);

create table if not exists public.competences (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid(),
  libelle         text not null,
  code_normalise  text not null unique,
  categorie       categorie_comp not null,
  precision       text,
  visible_cdg     boolean not null default true,
  visible_compta  boolean not null default true,
  ordre           int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

create table if not exists public.competence_liens (
  competence_id uuid not null references public.competences(id) on delete cascade,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  owner_id      uuid not null default auth.uid(),
  created_at    timestamptz not null default now(),
  primary key (competence_id, experience_id)
);

create table if not exists public.formations (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid(),
  diplome        text not null,
  etablissement  text,
  ville          text,
  date_debut     date,
  date_fin       date,
  visible_cdg    boolean not null default true,
  visible_compta boolean not null default true,
  ordre          int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

create table if not exists public.langues (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid(),
  langue        text not null,
  niveau        text,
  certification text,
  ordre         int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

create table if not exists public.interets (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid(),
  libelle    text not null,
  ordre      int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.accroches (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid(),
  volet      volet not null,
  texte      text not null,
  origine    text not null,
  validee    boolean not null default false,   -- RÈGLE D'OR (D9)
  offre_id   uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint accroche_origine_connue check (origine in ('cv_original','ia_reformulee'))
);

-- ---------------------------------------------------------------------
-- 4. BLOC OFFRES, DOCUMENTS ET SUIVI
-- ---------------------------------------------------------------------

create table if not exists public.offres (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null default auth.uid(),
  volet                 volet not null,
  source                text not null,
  source_url            text,
  source_reference      text,
  intitule              text,
  entreprise            text,
  localisation          text,
  departement           text,
  contrat               type_contrat,
  salaire_min           numeric,
  salaire_max           numeric,
  salaire_periode       text,
  salaire_mention_brute text,
  teletravail           text,
  date_publication      date,
  date_ajout            timestamptz not null default now(),
  date_candidature      timestamptz,
  contenu_brut          text not null,          -- source de vérité, jamais réécrite
  contenu_longueur      int,
  extraction_statut     statut_extraction not null default 'complet',
  extraction_message    text,
  hash_contenu          text,
  statut                statut_offre not null default 'enregistree',
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz,
  constraint source_connue check (source in ('url','texte','pdf','france_travail'))
);

create index if not exists idx_offres_volet_statut on public.offres(volet, statut);
create index if not exists idx_offres_hash on public.offres(hash_contenu);

create table if not exists public.offre_analyses (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid(),
  offre_id       uuid not null references public.offres(id) on delete cascade,
  resultat       jsonb not null,
  modele         text,
  prompt_version text,
  tokens_entree  int,
  tokens_sortie  int,
  cout_usd       numeric(10,6),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

create index if not exists idx_analyses_offre on public.offre_analyses(offre_id, created_at desc);

create table if not exists public.scores (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid(),
  offre_id          uuid not null references public.offres(id) on delete cascade,
  analyse_id        uuid references public.offre_analyses(id) on delete set null,
  score_global      int,
  score_missions    int,
  score_competences int,
  score_experience  int,
  score_secteur     int,
  plafonne          boolean not null default false,
  detail            jsonb not null,
  version_bareme    text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);

create index if not exists idx_scores_offre on public.scores(offre_id, created_at desc);

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid(),
  offre_id       uuid references public.offres(id) on delete cascade,
  type           type_document not null,
  volet          volet not null,
  version        int not null default 1,
  storage_path   text,
  contenu_texte  text,
  selection      jsonb,
  modele         text,
  cout_usd       numeric(10,6),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

create index if not exists idx_documents_offre on public.documents(offre_id, type, version desc);

create table if not exists public.statuts_historique (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid(),
  offre_id    uuid not null references public.offres(id) on delete cascade,
  statut      statut_offre not null,
  date        timestamptz not null default now(),
  commentaire text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_historique_offre on public.statuts_historique(offre_id, date desc);

create table if not exists public.appels_ia (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid(),
  tache         text not null,
  offre_id      uuid,
  modele        text,
  tokens_entree int,
  tokens_sortie int,
  cout_usd      numeric(10,6),
  succes        boolean not null default true,
  erreur        text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_appels_ia_date on public.appels_ia(created_at desc);

-- owner_id volontairement NULLABLE : les paramètres sont de la configuration
-- applicative globale, insérée par la migration hors de toute session
-- utilisateur (auth.uid() y vaut null).
create table if not exists public.parametres (
  cle        text primary key,
  owner_id   uuid default auth.uid(),
  valeur     jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------------
-- 5. HISTORISATION AUTOMATIQUE DES STATUTS
-- ---------------------------------------------------------------------
create or replace function public.journaliser_statut()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') or (new.statut is distinct from old.statut) then
    insert into public.statuts_historique (owner_id, offre_id, statut)
    values (new.owner_id, new.id, new.statut);
  end if;
  return new;
end $$;

drop trigger if exists trg_journaliser_statut on public.offres;
create trigger trg_journaliser_statut
  after insert or update of statut on public.offres
  for each row execute function public.journaliser_statut();

-- ---------------------------------------------------------------------
-- 6. TRIGGERS updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profil','experiences','missions','mission_formulations','competences',
    'formations','langues','interets','accroches','offres','offre_analyses',
    'scores','documents','parametres'
  ] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY — chaque table n'est lisible que par son propriétaire
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profil','experiences','missions','mission_formulations','competences',
    'competence_liens','formations','langues','interets','accroches','offres',
    'offre_analyses','scores','documents','statuts_historique','appels_ia'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists proprietaire on public.%I', t);
    execute format(
      'create policy proprietaire on public.%I
       for all to authenticated
       using (owner_id = auth.uid())
       with check (owner_id = auth.uid())', t);
  end loop;
end $$;

-- Les paramètres sont globaux : lisibles par l'utilisateur connecté même
-- lorsqu'ils n'ont pas de propriétaire.
alter table public.parametres enable row level security;
drop policy if exists proprietaire on public.parametres;
create policy proprietaire on public.parametres
  for all to authenticated
  using (owner_id is null or owner_id = auth.uid())
  with check (owner_id is null or owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- 8. STOCKAGE PRIVÉ DES DOCUMENTS GÉNÉRÉS
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents proprietaire" on storage.objects;
create policy "documents proprietaire" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and owner = auth.uid())
  with check (bucket_id = 'documents' and owner = auth.uid());

-- ---------------------------------------------------------------------
-- 9. PARAMÈTRES INITIAUX (D16, D17, D18)
-- ---------------------------------------------------------------------
insert into public.parametres (cle, owner_id, valeur) values
  ('bareme', null, '{
      "version": "1",
      "cdg":    { "missions": 35, "competences": 30, "experience": 20, "secteur": 15 },
      "compta": { "missions": 35, "competences": 35, "experience": 20, "secteur": 10 },
      "plafond_ecart_bloquant": 79,
      "neutre_experience_non_precisee": 75
   }'::jsonb),
  ('coefficients_anciennete', null, '{
      "cdi": 1.0, "cdd": 1.0, "alternance": 1.0,
      "stage": 0.5, "interim": 1.0, "freelance": 1.0, "autre": 0.5
   }'::jsonb),
  ('budget_ia', null, '{ "plafond_mensuel_usd": 10, "devise_affichage": "EUR" }'::jsonb),
  ('mode_generation_defaut', null, '"controle"'::jsonb)
on conflict (cle) do nothing;
