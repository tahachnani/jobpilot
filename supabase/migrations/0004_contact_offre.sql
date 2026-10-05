-- =====================================================================
-- JOBPILOT — Migration 0004 : destinataire de la lettre
--
-- Une lettre de motivation s'adresse à quelqu'un, à une adresse. La table
-- `offres` ne portait ni l'un ni l'autre : les annonces les mentionnent
-- rarement, mais on les connaît parfois.
--
-- Les deux champs sont facultatifs. À défaut, l'en-tête se limite au nom de
-- l'entreprise et à sa ville, et la formule d'appel reste « Madame, Monsieur ».
--
-- Idempotente : peut être rejouée sans erreur.
-- =====================================================================

alter table public.offres
  add column if not exists contact_nom text,
  add column if not exists contact_adresse text;

comment on column public.offres.contact_nom is
  'Nom du destinataire de la lettre, quand il est connu.';
comment on column public.offres.contact_adresse is
  'Adresse postale de l''entreprise, quand elle est connue.';
