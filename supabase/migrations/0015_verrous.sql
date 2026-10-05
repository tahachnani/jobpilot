-- D115 — un verrou pour ne pas payer deux fois la même génération.
--
-- Le 2 octobre, offre OPCO SANTE : deux recherches entreprise à vingt secondes
-- d'intervalle et deux lettres à six secondes, pour un seul clic annoncé.
-- Facture, 43 ¢ pour une lettre.
--
-- La première génération a duré soixante-quatre secondes — fiche entreprise
-- puis rédaction dans la même requête — au-delà de la limite d'une fonction
-- Vercel. Le navigateur a lâché, l'écran est resté muet, un second clic est
-- parti pendant que le premier appel continuait côté serveur.
--
-- Le bouton se désactive pourtant pendant la soumission. Mais `useFormStatus`
-- ne connaît que son propre formulaire, et ne survit ni à un rechargement ni à
-- l'expiration d'une requête : une protection d'interface ne protège pas une
-- dépense.

create table if not exists verrous (
  cle text primary key,
  expire_le timestamptz not null,
  pose_le timestamptz not null default now()
);

alter table verrous enable row level security;

drop policy if exists "utilisateur authentifie" on verrous;
create policy "utilisateur authentifie" on verrous
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- La pose est atomique : `on conflict do update` assorti d'un `where` sur
-- l'expiration ne modifie une ligne que si le verrou était libre ou périmé.
-- Deux appels simultanés ne peuvent donc pas réussir tous les deux — c'est
-- PostgreSQL qui arbitre, pas l'application.
create or replace function poser_verrou(p_cle text, p_secondes integer)
returns boolean language plpgsql security definer as $$
declare v_pose boolean;
begin
  insert into verrous (cle, expire_le, pose_le)
  values (p_cle, now() + make_interval(secs => p_secondes), now())
  on conflict (cle) do update
    set expire_le = now() + make_interval(secs => p_secondes), pose_le = now()
    where verrous.expire_le < now();
  get diagnostics v_pose = row_count;
  return v_pose;
end; $$;
