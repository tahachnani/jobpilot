-- =====================================================================
-- JOBPILOT — Migration 0011 : la taxonomie devient modifiable (D74)
--
-- Les codes d'activité vivaient dans `src/config/activites.ts`, figés à la
-- compilation. Or la taxonomie s'enrichit à presque chaque offre : « amélioration
-- continue » a été écrit dans le corpus d'une expérience et n'a jamais rien
-- noté, parce qu'aucun code ne portait ce nom.
--
-- La liste reste fermée — le scoring compare des codes, pas des mots — mais
-- c'est désormais toi qui la fermes. Le fichier versionné garde son rôle de
-- socle : il amorce la table, et sert de repli si celle-ci est vide ou
-- inatteignable, pour qu'un score reste toujours calculable.
--
-- Idempotente.
-- =====================================================================

create table if not exists public.activites (
  code        text primary key,
  libelle     text not null,
  famille     text not null check (famille in ('cdg', 'compta', 'transverse')),
  -- Vrai pour les trente codes d'origine. Ils sont modifiables comme les
  -- autres ; la marque sert seulement à distinguer ce qui vient du socle de ce
  -- que tu as ajouté à l'usage.
  socle       boolean not null default false,
  -- Un code retiré du service reste lisible par le moteur — les missions qui
  -- le portent gardent leur sens — mais n'est plus proposé au modèle ni à la
  -- saisie. C'est la retraite d'un code, pas son effacement.
  actif       boolean not null default true,
  ordre       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

alter table public.activites enable row level security;

-- Table de référence, pas de données personnelles : elle est lisible par tout
-- compte authentifié, et l'application n'a qu'un utilisateur.
drop policy if exists lecture on public.activites;
create policy lecture on public.activites
  for select to authenticated using (true);

drop policy if exists ecriture on public.activites;
create policy ecriture on public.activites
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_touch_activites on public.activites;
create trigger trg_touch_activites
  before update on public.activites
  for each row execute function public.touch_updated_at();

-- Amorçage du socle. `on conflict do nothing` : relancer la migration ne doit
-- pas écraser un libellé que tu aurais corrigé depuis l'écran.
insert into public.activites (code, libelle, famille, socle, ordre) values
  ('reporting',             'Reporting',                 'cdg',        true,  1),
  ('budget',                'Budget',                    'cdg',        true,  2),
  ('previsionnel',          'Prévisionnel',              'cdg',        true,  3),
  ('analyse_ecarts',        'Analyse des écarts',        'cdg',        true,  4),
  ('tableaux_bord',         'Tableaux de bord',          'cdg',        true,  5),
  ('kpi',                   'KPI',                       'cdg',        true,  6),
  ('couts_revient',         'Coûts de revient',          'cdg',        true,  7),
  ('marges',                'Marges',                    'cdg',        true,  8),
  ('rentabilite',           'Rentabilité',               'cdg',        true,  9),
  ('analyse_financiere',    'Analyse financière',        'cdg',        true, 10),
  ('business_partner',      'Business partner',          'cdg',        true, 11),
  ('consolidation',         'Consolidation',             'cdg',        true, 12),
  ('tresorerie',            'Trésorerie',                'cdg',        true, 13),
  ('investissements',       'Investissements',           'cdg',        true, 14),
  ('compta_generale',       'Comptabilité générale',     'compta',     true, 15),
  ('compta_analytique',     'Comptabilité analytique',   'compta',     true, 16),
  ('compta_fournisseurs',   'Comptabilité fournisseurs', 'compta',     true, 17),
  ('compta_clients',        'Comptabilité clients',      'compta',     true, 18),
  ('rapprochements',        'Rapprochements',            'compta',     true, 19),
  ('lettrage',              'Lettrage',                  'compta',     true, 20),
  ('cloture',               'Clôture',                   'compta',     true, 21),
  ('revision',              'Révision',                  'compta',     true, 22),
  ('declarations_fiscales', 'Déclarations fiscales',     'compta',     true, 23),
  ('tva',                   'TVA',                       'compta',     true, 24),
  ('paie',                  'Paie',                      'compta',     true, 25),
  ('immobilisations',       'Immobilisations',           'compta',     true, 26),
  ('fiabilisation_donnees', 'Fiabilisation des données', 'transverse', true, 27),
  ('audit_interne',         'Audit interne',             'transverse', true, 28),
  ('parametrage_erp',       'Paramétrage ERP',           'transverse', true, 29),
  ('automatisation',        'Automatisation',            'transverse', true, 30)
on conflict (code) do nothing;
