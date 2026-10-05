-- D108 — la fiche entreprise, rangée par employeur et non par offre.
--
-- Une recherche web coûte 1 ¢ plus le contenu rapporté. La ranger par offre
-- la ferait repayer à chaque régénération de lettre, et une deuxième fois si
-- une autre annonce du même employeur arrivait. Elle porte sur l'entreprise :
-- c'est donc l'entreprise qui l'indexe.
--
-- Le même enregistrement sert la lettre, la préparation d'entretien, la
-- relance et la fiche d'offre.

create table if not exists recherches_entreprise (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- Le nom tel qu'il apparaît dans l'annonce, pour l'affichage.
  entreprise text not null,
  -- Le nom réduit à l'essentiel, pour le rapprochement : minuscules, sans
  -- accents, sans ponctuation, sans forme juridique. « IN'LI SAS » et « in'li »
  -- doivent tomber sur la même fiche.
  cle text not null,

  -- La fiche structurée : activité, taille, implantation, faits datés, sources.
  resultat jsonb not null,

  -- D'où elle vient, pour que l'écran puisse le dire honnêtement.
  --   'web'     : recherche web facturée
  --   'annonce' : l'annonce suffisait, aucune recherche lancée
  origine text not null default 'web',

  recherches integer not null default 0,
  cout_usd numeric(10, 6) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une seule fiche par employeur et par propriétaire : c'est ce qui rend la
-- réutilisation automatique plutôt que facultative.
create unique index if not exists recherches_entreprise_cle_unique
  on recherches_entreprise (owner_id, cle);

alter table recherches_entreprise enable row level security;

drop policy if exists "proprietaire seul" on recherches_entreprise;
create policy "proprietaire seul" on recherches_entreprise
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
