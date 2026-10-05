-- =====================================================================
-- JOBPILOT — Migration 0008 : règles d'écriture du bucket documents
--
-- Constat d'audit du 20 septembre 2026 : aucune règle n'existait sur
-- `storage.objects`. Le bucket `documents` est privé, RLS y est actif par
-- défaut, et sans règle **tout envoi est refusé**. Résultat : 54 CV sur 54 et
-- 15 lettres sur 17 enregistrés sans fichier.
--
-- Rien ne se voyait, parce que la génération retombe sur la recomposition du
-- PDF depuis `documents.selection` : le téléchargement fonctionnait, en
-- recomposant à chaque fois. La panne était donc muette depuis l'étape 4.
--
-- La section 8 de la migration 0001 portait bien une règle, mais elle n'a
-- jamais atteint la base — probablement un `drop policy ... on
-- storage.objects` refusé faute de droits, qui a interrompu le script à cet
-- endroit. Elle est reprise ici, découpée par opération : c'est la forme
-- recommandée, et elle évite le piège du `with check` sur `owner`, qui n'est
-- pas encore renseigné au moment de l'insertion.
--
-- Idempotente.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents proprietaire" on storage.objects;
drop policy if exists "documents ecriture"     on storage.objects;
drop policy if exists "documents lecture"      on storage.objects;
drop policy if exists "documents maj"          on storage.objects;
drop policy if exists "documents suppression"  on storage.objects;

create policy "documents ecriture" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents');

create policy "documents lecture" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());

create policy "documents maj" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and owner = auth.uid())
  with check (bucket_id = 'documents');

create policy "documents suppression" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and owner = auth.uid());
