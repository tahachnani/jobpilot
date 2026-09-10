# JobPilot — reprise de projet

État du projet au 10 septembre 2026, après les étapes 4, 4bis et 5.
À joindre au premier message d'une nouvelle conversation.

---

## Où en est le projet

**Cinq étapes sur six sont en ligne et fonctionnent.**

| Étape | Contenu | État |
|---|---|---|
| 1 | Socle, base, authentification | en ligne |
| 2 | Base professionnelle, deux volets | en ligne |
| 3 | Ingestion et analyse d'offres, score | en ligne |
| 4 | Génération de CV en PDF | en ligne |
| 4bis | Reformulation des missions par offre | en ligne |
| 5 | Lettre de motivation et email | en ligne |
| 6 | Statuts, envois, relances, suivi | à faire |

Dépôt `tahachnani/jobpilot`, branche `main`. Travail dans un Codespace GitHub,
déploiement Vercel déclenché par `git push`. Supabase `lpmafnifheuljzuuerdr`.

---

## Ce que fait l'application

**Le CV** est composé sans aucun appel IA. La sélection des missions est
arithmétique : codes d'activité partagés avec l'offre, pondérés par
l'importance qu'elle leur donne, quotas par expérience, deux emprunts au
maximum à l'autre volet. Une page garantie par six crans de compacité, avec
relecture du nombre de pages réellement composé. Régénérer ne coûte rien.

**La reformulation** (étape 4bis) adapte les missions au vocabulaire de
l'annonce. Un contrôle arithmétique compare la proposition à l'original et
rejette toute invention **comme toute rature** : chiffre ajouté ou perdu,
sigle effacé, outil disparu, verbe d'action devenu substantif. Ce qui passe le
contrôle est relu côte à côte et validé mission par mission.

**La lettre** (étape 5) est le seul endroit où le modèle écrit depuis une page
blanche. Il a le droit d'inventer la motivation, jamais un fait. Un contrôle
d'ancrage confronte chaque chiffre et chaque nom propre de la lettre au
parcours complet et à l'annonce ; ce qui n'est adossé à rien est signalé sans
bloquer. La lettre se relit d'un bloc dans un champ modifiable. L'email est
rédigé dans la foulée, copiable et réécrivable seul.

---

## Migrations et données, déjà appliquées

- `0003_periodes_experience.sql` — table `experience_periodes`. Les cabinets
  d'expertise comptable portent deux périodes : juin 2019, puis juin à août
  2022. Le CV affiche « Juin 2019 & Juin – Août 2022 ».
- `0004_contact_offre.sql` — `contact_nom` et `contact_adresse` sur `offres`,
  facultatifs, saisis depuis l'écran Lettre.
- Ligne « Arabe » supprimée de `langues`, niveau de « Français » vidé,
  certification de l'anglais passée à « TOEIC 825/990 (B2) ».
- `titre_cdg` harmonisé en « Contrôleur de Gestion » sur les quatre postes.
- Compétence « Logiciels comptables » (ajoutée depuis une offre) renommée et
  ramenée au niveau 1.

---

## Pièges rencontrés, à ne pas réapprendre

**React-PDF et l'interligne.** Un `lineHeight` propre à un bloc, différent de
celui de la page, est mal résolu : le nom du CV se superposait au titre,
l'accroche sortait à interligne double, l'en-tête de la lettre à 23 pt au lieu
de 14. **Ne jamais surcharger `lineHeight` sur un élément** ; jouer sur la
taille de police.

**pdfkit et Vercel.** Les polices standard sont chargées par un `require`
calculé, invisible à l'analyse statique. Sans
`experimental.outputFileTracingIncludes` dans `next.config.mjs`, tout marche en
local et rien en ligne.

**Les limites de jetons.** Une lettre plus un email en JSON dépassent 3000
jetons : la réponse était tronquée et l'analyse échouait. À 8000, plus de
problème. Toujours remonter le début de la réponse brute dans le message
d'erreur, sinon le diagnostic passe par les journaux.

**`git add -A` avant `git commit`.** Deux séances perdues sur des commits vides
suivis de « Everything up-to-date » : Vercel construisait l'ancienne version.

**L'estimateur du CV est calibré sur du réel.** `largeurCaractere = 0.452`,
mesuré sur un CV composé. La valeur théorique de 0,505 faisait retirer des
missions pour rien. Tous les réglages sont groupés dans
`src/lib/cv/mise-en-page.ts`.

---

## Prochaine étape

**Étape 6** : statuts d'offre, bouton « Marquer comme envoyée », relances,
suivi des candidatures. L'énumération `statut_offre` prévoit déjà
`cv_genere`, `lettre_generee`, `email_genere`, `envoyee`, `entretien`,
`refusee`, `sans_reponse`, `cloturee` — aucune n'est utilisée aujourd'hui,
générer un document ne change aucun statut.

---

## Méthode de travail

Spécification écrite et validée avant toute ligne de code, décisions numérotées
(D1 à D35 à ce jour, dans `docs/`). Validation bloc par bloc. Aucune
modification d'architecture, de données ou de logique de scoring sans accord
explicite. `npm run build` avant chaque commit.
