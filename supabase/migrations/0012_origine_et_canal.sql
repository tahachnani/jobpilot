-- =====================================================================
-- JOBPILOT — Migration 0012 : origine de l'offre et canal de relance
--                              (D83, D84)
--
-- Deux colonnes, deux constats d'usage.
--
-- `origine` remplace le commentaire libre saisi au moment de l'envoi : on n'a
-- jamais rien à y écrire à cet instant, et une liste fermée se compte. Couplée
-- aux issues connues (D68), elle répond à la question qui décide où passer son
-- temps : quel canal donne des entretiens.
--
-- `canal_relance` acte que la plupart des plateformes ne donnent aucune
-- adresse. La relance passe par leur messagerie ou par LinkedIn, et ce qu'on
-- écrit n'est pas le même texte.
--
-- Texte libre plutôt qu'énumération : la liste des sites d'emploi bouge plus
-- vite qu'un schéma, et une valeur inconnue doit rester lisible plutôt que de
-- faire échouer une écriture déjà payée. Le contrôle se fait côté application.
--
-- Idempotente.
-- =====================================================================

alter table public.offres
  add column if not exists origine       text,
  add column if not exists canal_relance text;

comment on column public.offres.origine is
  'Code de la plateforme ou du canal par lequel la candidature est partie — voir src/config/origines.ts. Null = non renseigné.';

comment on column public.offres.canal_relance is
  'Par où relancer : plateforme, linkedin, email, telephone. Null = non choisi.';

-- Les candidatures en attente se lisent par leur relance due ; l'origine sert
-- au comptage par canal, toujours à l'intérieur d'un volet.
create index if not exists idx_offres_origine
  on public.offres(volet, origine);
