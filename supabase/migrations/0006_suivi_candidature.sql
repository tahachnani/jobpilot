-- Étape 6 — suivi des candidatures (D46, D47).
--
-- L'énumération `statut_offre`, la table `statuts_historique` et son
-- déclencheur existent depuis l'étape 1 et ne changent pas. Il manque
-- seulement de quoi porter une relance : quand elle est prévue, quand elle a
-- eu lieu, et combien de fois.

alter table public.offres
  add column if not exists relance_prevue_le   date,
  add column if not exists derniere_relance_le date,
  add column if not exists relances            int not null default 0;

-- Le tableau de bord ne lit que les relances dues sur des offres envoyées :
-- l'index n'a pas à porter le reste.
create index if not exists idx_offres_relance
  on public.offres(relance_prevue_le)
  where statut = 'envoyee' and relance_prevue_le is not null;
