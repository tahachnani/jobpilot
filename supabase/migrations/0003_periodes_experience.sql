-- =====================================================================
-- JOBPILOT — Migration 0003 : périodes multiples d'une expérience
--
-- Une expérience regroupée peut correspondre à plusieurs séjours qui ne se
-- suivent pas : les cabinets d'expertise comptable, juin 2019 puis juin à
-- août 2022. Les colonnes `date_debut` / `date_fin` ne savent exprimer qu'un
-- intervalle continu, ce qui affichait « Juin 2019 – Août 2022 » sur le CV,
-- soit trois ans annoncés pour quatre mois travaillés.
--
-- Cette table décrit les périodes réelles. Quand elle est vide pour une
-- expérience, rien ne change : la période reste `date_debut → date_fin`.
--
-- Idempotente : peut être rejouée sans erreur.
-- =====================================================================

create table if not exists public.experience_periodes (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  date_debut    date not null,
  date_fin      date,                       -- null = période en cours
  ordre         int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  constraint periode_dates_coherentes
    check (date_fin is null or date_fin >= date_debut)
);

create index if not exists idx_periodes_experience
  on public.experience_periodes(experience_id, ordre);

comment on table public.experience_periodes is
  'Périodes réelles d''une expérience qui en regroupe plusieurs, non contiguës. Vide dans le cas courant : la période est alors date_debut → date_fin de l''expérience.';

drop trigger if exists trg_touch_experience_periodes on public.experience_periodes;
create trigger trg_touch_experience_periodes
  before update on public.experience_periodes
  for each row execute function public.touch_updated_at();

alter table public.experience_periodes enable row level security;
drop policy if exists proprietaire on public.experience_periodes;
create policy proprietaire on public.experience_periodes
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
