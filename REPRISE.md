# JobPilot — reprise de projet

État du projet au 23 septembre 2026, étape 6 et trois passes d'amélioration comprises.
À joindre au premier message d'une nouvelle conversation.

---

## Où en est le projet

**Les six étapes sont écrites, plus une passe de dix améliorations
(`docs/AMELIORATIONS_10.md`, D53 à D62).**

| Étape | Contenu | État |
|---|---|---|
| 1 | Socle, base, authentification | en ligne |
| 2 | Base professionnelle, deux volets | en ligne |
| 3 | Ingestion et analyse d'offres, score | en ligne |
| 4 | Génération de CV en PDF | en ligne |
| 4bis | Reformulation des missions par offre | en ligne |
| 4ter | Corpus d'expérience, missions proposées | en ligne |
| 5 | Lettre de motivation et email | en ligne |
| 6 | Statuts, envois, relances, suivi | en ligne |
| — | Dix améliorations (D53–D62) | en ligne |
| — | Score, marché caché, entretien (D64–D73) | à déployer |
| — | Taxonomie éditable (D74–D76) | à déployer |

Dépôt `tahachnani/jobpilot`, branche `main`. Travail dans un Codespace GitHub,
déploiement Vercel déclenché par `git push`. Supabase `lpmafnifheuljzuuerdr`.

**L'URL stable est `jobpilot-chnani.vercel.app`.** Les URL de prévisualisation
(`jobpilot-xxxxx-…`) sont figées sur le déploiement qui les a créées : plusieurs
séances ont été passées à chercher dans le code un bug qui n'était qu'une page
périmée.

---

## Ce que fait l'application

**Le CV** est composé sans aucun appel IA. La sélection des missions est
arithmétique : codes d'activité partagés avec l'offre, pondérés par
l'importance qu'elle leur donne, quotas par expérience, deux emprunts au
maximum à l'autre volet. Une page garantie par six crans de compacité, avec
relecture du nombre de pages réellement composé. Régénérer ne coûte rien.

**La reformulation** (étape 4bis) adapte les missions au vocabulaire de
l'annonce. Une reformulation n'est retenue que si elle apporte quelque chose de
l'offre : une modification de pure forme est écartée. Un contrôle arithmétique
compare la proposition à l'original et rejette toute invention **comme toute
rature** : chiffre ajouté ou perdu, sigle effacé, outil disparu, verbe d'action
devenu substantif. Ce qui passe le contrôle est relu côte à côte et validé
mission par mission ; ce qui est écarté reste visible, avec son motif, et peut
être accepté à la main.

**Le corpus** (étape 4ter) est la matière première. Trente-trois entrées
tirées de documents de travail réels, cloisonnées par expérience : ce qui a été
fait chez un employeur n'autorise rien dans la mission d'un autre. Il ne paraît
sur aucun CV. Il sert à deux choses : autoriser un terme en reformulation, et
alimenter les **missions proposées** — au plus trois par offre, créées
inactives, à accepter une par une. Il se lit, se modifie, s'ajoute et se
supprime depuis « Mon profil », bloc « Corpus » de chaque expérience.

**L'écart et le potentiel.** Le CV généré est comparé à un CV de référence
(la même sélection avec une offre neutralisée) pour montrer toutes les
adaptations. Le potentiel distingue ce qui est **récupérable** — un terme de
l'offre dont tous les mots figurent dans une même ligne du parcours — de ce qui
est **hors de portée**.

**Le score** ne mesure plus le seul thème de l'offre. Un critère que
l'annonce ne permet pas d'évaluer **sort du calcul** et son poids passe aux
autres, au lieu de recevoir une note neutre — trois planchers à 70 et 75
remontaient mécaniquement tous les scores, et l'un d'eux figeait 35 % du total.
Le niveau du poste, lu ou déduit de l'intitulé et de l'encadrement, sert
d'exigence quand aucune durée n'est chiffrée. Et le vocabulaire départage deux
missions qui partagent un code : la note n'est plus binaire. `docs/AMELIORATIONS_SCORE.md`.

**La taxonomie** des activités vit désormais en base et se modifie depuis son
propre onglet : ajouter un code, corriger un libellé, mettre un code hors
service. La liste reste fermée — le moteur compare des codes, pas des mots —
mais c'est toi qui la fermes. Les codes d'une mission sont modifiables dans
« Mon profil » : ce sont les seuls que le score compare. Toute modification
incrémente la version du barème et appelle un recalcul.
`docs/TAXONOMIE_EDITABLE.md`.

**Le marché caché** tient la liste des entreprises visées sans annonce
publiée, avec l'état de la démarche. Rien n'y est collecté automatiquement.

**La préparation d'entretien** part de l'annonce, du CV réellement envoyé et
des écarts mesurés. Elle ne rédige aucune réponse : elle pose les questions et
nomme ce sur quoi s'appuyer.

**Le suivi** (étape 6) sépare deux régimes qui ne se mélangent jamais. La
préparation avance toute seule et seulement vers l'avant : générer un CV pose
`cv_genere`, écrire la lettre pose `lettre_generee`, régénérer l'email pose
`email_genere` — et une offre déjà envoyée ne recule pas parce qu'on
régénère. L'envoi, lui, ne s'atteint qu'à la main : l'application n'envoie
rien et ne peut pas le deviner. Marquer une offre comme envoyée pose la date
de candidature et propose une relance à dix jours ; « Relancé aujourd'hui »
repousse la suivante sans changer le statut. Les issues se déclarent au
sélecteur, avec un commentaire écrit sur la ligne d'historique. Tout statut
reste corrigible, y compris en arrière.

**La lettre** (étape 5) est le seul endroit où le modèle écrit depuis une page
blanche. Il a le droit d'inventer la motivation, jamais un fait. Un contrôle
d'ancrage confronte chaque chiffre et chaque nom propre de la lettre au
parcours complet et à l'annonce ; ce qui n'est adossé à rien est signalé sans
bloquer. La lettre se relit d'un bloc dans un champ modifiable, se copie, et se
réécrit dans un autre style d'un bouton. L'email est rédigé dans la foulée,
copiable et réécrivable seul.

---

## Migrations et données, déjà appliquées

- `0003_periodes_experience.sql` — table `experience_periodes`. Les cabinets
  d'expertise comptable portent deux périodes : juin 2019, puis juin à août
  2022. Le CV affiche « Juin 2019 & Juin – Août 2022 ».
- `0004_contact_offre.sql` — `contact_nom` et `contact_adresse` sur `offres`,
  facultatifs, saisis depuis l'écran Lettre.
- `0005_corpus_experience.sql` — table `corpus_experience` (texte, codes
  d'activité, source, ordre) et colonne `motif_rejet` sur les reformulations.
- Ligne « Arabe » supprimée de `langues`, niveau de « Français » vidé,
  certification de l'anglais passée à « TOEIC 825/990 (B2) ».
- `titre_cdg` harmonisé en « Contrôleur de Gestion » sur les quatre postes.
- Compétence « Logiciels comptables » renommée et ramenée au niveau 1, AS/400
  ajoutée.
- 33 entrées de corpus : 16 LMMH, 10 TECHNICAPS, 7 TRIUMPH.
- Barème passé en **version 5** : mêmes poids nominaux (cdg 30/25/35/10,
  compta 30/30/30/10), mais redistribués sur les seuls critères mesurables
  (D66) ; une qualité comportementale compte pour moitié (D63).

## Les migrations qui restent à appliquer

- `0006_suivi_candidature.sql` — `relance_prevue_le`, `derniere_relance_le` et
  `relances` sur `offres`, plus un index partiel. Sans elle, les écrans de
  suivi lisent des colonnes absentes et échouent.
- `0007_relance_et_index.sql` — ajoute `relance` à `type_document`. **À lancer
  seule** : `add value` n'accepte pas d'être dans une transaction.
- `0009_entreprises_cibles.sql` — table du marché caché, avec son énumération,
  sa règle RLS et son déclencheur d'horodatage.
- `0010_type_preparation.sql` — ajoute `preparation` à `type_document`. **À
  lancer seule**, même raison que la 0007.
- `0011_taxonomie.sql` — table `activites`, amorcée avec les trente codes du
  socle. Sans elle, l'onglet Taxonomie s'affiche en lecture seule et
  l'application continue sur le fichier versionné : rien de cassé, rien de
  modifiable.
- `0005_corpus_experience.sql` — reconstituée après coup : elle avait été
  appliquée à la main à l'étape 4ter sans être versionnée. Sans effet sur la
  base existante, indispensable pour repartir d'un projet Supabase neuf.

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
local et rien en ligne. Épingler `pdfkit` en `overrides` **aggrave** le
problème : les fichiers manquants n'existent qu'à partir de la 0.20.

**Les limites de jetons.** Trois pannes identiques : lettre à 3000,
reformulation à 4000 puis 8000, propositions à 4000 — chaque fois la limite
exacte, chaque fois un JSON tronqué. Le modèle émet un raisonnement invisible
compté dans les jetons de sortie. Aujourd'hui 8000 / 12000 / 8000. Toujours
remonter le début de la réponse brute dans le message d'erreur.

**Les codes d'activité sont une taxonomie fermée.** Trois missions proposées
portaient « analyse financière » au lieu de `analyse_financiere` : acceptées en
base, invisibles au moteur de sélection, absentes de tous les CV. Tout code
écrit par un modèle ou saisi à la main passe par un filtre — sur la table
`activites` depuis D74, sur le socle versionné en repli.

**Un filtre qui se tait transforme une saisie en perte de données.** Le même
filtre écartait en silence un code hors liste : une entrée de corpus portant
« amélioration continue » a été enregistrée avec zéro code, sans un mot, et le
sujet est resté à zéro dans les missions pendant qu'on cherchait la panne
ailleurs. Un refus se dit, toujours, avec le moyen de le lever.

**Le corpus ne compte dans aucun score.** Le calcul lit les codes des
*missions*. Le corpus autorise un terme en reformulation et mesure ce qui est
récupérable — rien d'autre. C'est écrit à l'écran depuis D76, parce que rien ne
le laissait deviner.

**Ce qui est écrit dans `documents.selection` est figé pour toujours.** Un
document généré avant l'étape 4ter n'a pas de `potentiel` à la forme attendue :
l'écran Formulations plantait dessus. Tout lecteur doit tolérer les formes
anciennes.

**`git add -A` avant `git commit`.** Deux séances perdues sur des commits vides
suivis de « Everything up-to-date » : Vercel construisait l'ancienne version.

**Une archive non appliquée se déguise en bug ailleurs.** Trois fois : un
fichier manquant produisait une erreur de compilation qui semblait venir d'un
tout autre endroit. Livrer peu d'archives, groupées, et vérifier que chaque
fichier annoncé est bien sur le disque.

**Une migration appliquée à la main finit par manquer.** La 0005 n'avait
jamais été versionnée : le dépôt sautait de 0004 à 0006, et une base
reconstruite depuis les migrations n'aurait eu ni corpus ni `motif_rejet`.
Toute modification de schéma passe par un fichier, même appliquée d'abord dans
l'éditeur.

**Une redirection Next passe par une exception.** Un `redirect()` placé dans un
`try` est attrapé par le `catch` et transformé en message d'erreur. Il reste
donc toujours hors du bloc surveillé.

**Une valeur neutre haute est un mensonge qui s'ignore.** Trois planchers —
70, 70, 75 — avaient été posés pour ne pas pénaliser une offre muette. Ils ont
fini par rendre tous les scores identiques, et le critère le plus lourd était
le plus souvent constant. Ce qu'on ne peut pas mesurer se retire du calcul ; on
ne lui invente pas une note.

**Une vérification qui ne filtre que les erreurs de syntaxe ne vérifie rien.**
Une redéclaration de variable est une erreur TS2451, pas TS1xxx : elle passait
dans le bruit de mon contrôle hors ligne et a cassé un déploiement. Le filtre
ne retire plus que les erreurs imputables à l'absence de `node_modules`.

**Le répertoire de travail n'est pas le dépôt.** Après une réinitialisation du
conteneur, ma copie a été reconstruite en réappliquant les archives dans
l'ordre — et `src/lib/termes.ts` y est resté à une version antérieure, sans
`estSavoirFaire` ni `noyauDuTerme`, alors que trois fichiers les importent.
Aucun dégât : ce fichier n'a jamais été livré, et la comparaison complète des
deux arbres n'a montré que lui. Mais avant toute passe qui touche à plusieurs
fichiers, la copie de travail se resynchronise sur un zip du dépôt.

**L'estimateur du CV est calibré sur du réel.** `largeurCaractere = 0.452`,
mesuré sur un CV composé. La valeur théorique de 0,505 faisait retirer des
missions pour rien. Tous les réglages sont groupés dans
`src/lib/cv/mise-en-page.ts`.

---

## Prochaine étape

Il n'y a plus d'étape prévue. Ce qui reste en suspens, par ordre de gêne :

- Le **coût IA du mois** du tableau de bord est encore écrit en dur à
  « 0,00 $ », alors que `appels_ia` porte les coûts réels.
- Neuf lignes de mission sur 305 (3 %) ne sont rattachées à aucun code : elles
  sortent du calcul depuis D66, et s'affichent « hors calcul » depuis D73.
  L'onglet Taxonomie est fait pour les rattraper une à une.
- Les CV et lettres déjà produits gardent la forme qu'ils avaient : un
  document d'avant l'étape 4ter n'a pas de `potentiel` exploitable.

---

## Les tests

`npm test`, ou automatiquement avant `npm run build`. Soixante et onze cas sur
le contrôle de reformulation, le barème, l'ordre des compétences, l'estimateur
de page, la comparaison de termes, le découpage des libellés d'annonce, la
taxonomie et le suivi. Ils **bloquent en local et jamais
sur Vercel** : le lanceur se retire quand il détecte la construction en ligne.
Aucune dépendance — Node exécute le TypeScript directement depuis la 22.6, et
les chemins `@/…` passent par `scripts/alias-hooks.mjs`.

Un test qui échoue dit l'une de deux choses : une régression, ou une règle qui
a changé exprès. Dans le second cas, c'est le test qu'on met à jour — jamais en
le supprimant sans le remplacer.

---

## Méthode de travail

Spécification écrite et validée avant toute ligne de code, décisions numérotées
(D1 à D76 à ce jour, dans `docs/`). Validation bloc par bloc. Aucune
modification d'architecture, de données ou de logique de scoring sans accord
explicite. `npm run build` avant chaque commit. Livraison des **fichiers
modifiés uniquement**, pas de l'archive complète.
