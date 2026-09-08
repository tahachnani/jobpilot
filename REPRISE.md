# JobPilot — reprise de projet

Archive du projet à jour au 8 septembre 2026, après l'étape 4.
À joindre au premier message d'une nouvelle conversation.

## État

Étape 3 en ligne sur https://jobpilot-chnani.vercel.app
Projet Vercel `jobpilot`, scope `chnani` (compte personnel, offre Hobby),
teamId `team_tdfD8aysEH5HXo3t0ugyMiBA`.

**L'étape 4 est écrite mais pas encore déployée.** Elle ajoute une dépendance,
`@react-pdf/renderer`, donc `npm install` puis un déploiement complet sont
nécessaires. Rien n'a été testé en ligne.

## Base Supabase

Projet `lpmafnifheuljzuuerdr`. Barème en **version 2**.

Modifications de l'étape 4, **déjà appliquées en base** :

- Table `experience_periodes` créée (migration `0003`), RLS active.
  Deux périodes saisies pour les cabinets d'expertise comptable :
  juin 2019, puis juin à août 2022.
- Ligne « Arabe » supprimée de `langues`, ordres renumérotés (1 Français,
  2 Anglais, 3 Espagnol).
- Niveau de la ligne « Français » vidé : la certification DALF C1 en tenait
  déjà lieu.

## Ce que fait l'étape 4

Génération d'un CV PDF adapté à une offre analysée, **sans aucun appel IA**.

- Sélection des missions par codes d'activité partagés avec l'offre, pondérés
  par l'importance que l'offre leur donne. À égalité, la mission chiffrée
  passe devant.
- Emprunt à l'autre volet : une mission par expérience, deux par CV, et
  seulement si l'offre la réclame.
- Textes repris **mot pour mot** depuis `mission_formulations`. Aucune
  reformulation : elle est reportée, c'est là qu'une IA invente.
- Compétences ordonnées par pertinence à l'offre, cœur de métier d'abord.
- Mise en page unique, une seule colonne, Helvetica, dates en toutes lettres.
- **Une page, strictement** : six crans de compacité, estimation avant rendu
  puis relecture du nombre de pages réellement composé.
- Chaque génération ajoute une version dans `documents` et ne remplace rien.
  Le modèle complet est stocké, donc le PDF reste reproductible même si la
  base évolue ensuite.

Fichiers : `src/lib/cv/` (donnees, selection, modele, document, encombrement,
rendu, generer), route `src/app/document/[id]/route.ts`, action `genererCV`,
page `mes-cv` réécrite.

## Points de vigilance

- **Le CV n'a jamais été composé pour de vrai.** L'estimateur a été validé hors
  application sur les vraies missions, mais React-PDF n'a pas tourné. Les
  premiers CV réels serviront à ajuster `MESURES` dans
  `src/lib/cv/mise-en-page.ts` — chaque réglage empirique y est signalé.
- Le connecteur **GitHub reste en lecture seule** : `403 Resource not
  accessible by integration`. Le dépôt `tahachnani/jobpilot` est resté à
  l'état de l'étape 1. Tous les déploiements passent par un envoi complet à
  Vercel. À résoudre.
- Le connecteur Supabase, lui, écrit correctement.
- `next.config.mjs` déclare `@react-pdf/renderer` en paquet externe : sans
  cela le bundler de Next le casse.

## Prochaine étape

Étape 5 : lettre de motivation et emails de candidature, avec l'accroche
personnalisée par offre. À spécifier par écrit avant toute ligne de code.

## Méthode de travail

Spécification écrite et validée avant toute ligne de code. Validation bloc par
bloc. Aucune modification d'architecture, de données ou de logique de scoring
sans accord explicite.
