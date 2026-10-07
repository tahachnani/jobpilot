-- D128 : le journal garde le coût et les jetons, jamais la durée.
-- `const debut = Date.now()` existait dans anthropic.ts, suivi d'un
-- `void debut;` : la mesure était prise et jetée. Deux décisions
-- d'architecture ont pourtant été arbitrées sur des durées estimées.
alter table appels_ia add column if not exists duree_ms integer;
