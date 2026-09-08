# JobPilot — Étape 4 : génération des CV personnalisés

**Spécification validée par Taha le 7 septembre 2026. Prête à implémenter.**

## Périmètre

Génération, pour une offre analysée, d'un CV PDF adapté : sélection des
missions les plus pertinentes, ordre des compétences, accroche.

Hors périmètre : lettre de motivation (étape 5), changement de statut et
bouton « Marquer comme envoyée » (étape 6), édition du barème (étape 6).

## Décisions validées

### Mise en page — une seule, optimisée ATS

Les deux modèles d'origine divergeaient sur sept points de forme. Décision :
une mise en page unique, choisie pour la lisibilité machine.

- **Une seule colonne partout.** Les compétences et les langues en deux
  colonnes du CV comptable disparaissent : un ATS lit un PDF en flux et
  entrelace les lignes des colonnes.
- **Dates en toutes lettres** : `Septembre 2024 – Août 2025`. Le format
  `2024-09` est moins bien reconnu par les analyseurs français.
- **En-tête d'expérience sur deux lignes** : intitulé et dates, puis
  entreprise et ville.
- **Puces simples.** Aucune icône, aucun tableau, polices standard, pas
  d'en-tête ni de pied de page.
- **Type de contrat affiché** (CDI, CDD, Alternance, Stage).

Le titre du CV, l'accroche et les intitulés de poste restent propres au volet
(`titre_cdg` / `titre_compta`).

### Quotas de missions — adaptatifs

Cible **4 / 4 / 3 / 3** dans l'ordre : expérience la plus récente,
alternance, puis les autres. Le générateur estime l'encombrement avant le
rendu et retombe sur **4 / 3 / 3 / 3** si la page déborde.

Contrainte absolue : une seule page.

### Emprunt à l'autre volet

Une mission comptable peut figurer dans un CV CDG quand l'offre la réclame,
dans ces limites strictes :

- **une par expérience au maximum**
- **deux sur l'ensemble du CV au maximum**

L'emprunt est un appoint, il ne doit pas déplacer le centre de gravité du CV.

### Sélection des missions — déterministe

Pour chaque mission de la base, on compte les codes d'activité partagés avec
les missions de l'offre, pondérés par l'importance que l'offre leur donne. On
garde les mieux notées dans la limite du quota. À égalité, la mission chiffrée
(`contient_chiffre`) passe devant.

Aucun appel IA dans la sélection.

### Texte des missions — pas de reformulation

Chaque mission est rendue avec sa formulation du volet, telle que stockée dans
`mission_formulations`. Jamais `texte_source`, qui reste la référence du
contrôle d'invention.

La reformulation IA orientée offre est **reportée**, et sera ajoutée plus tard
comme option avec validation ligne par ligne et comparaison au texte source.
Motif : c'est l'endroit où une IA invente, et le générateur doit d'abord être
vérifiable de bout en bout.

### Compétences

Celles visibles dans le volet, ordonnées par pertinence à l'offre — celles que
l'offre réclame d'abord — puis par niveau décroissant. Neuf à dix lignes.

### Langues — trois, identiques sur les deux CV

Français (DALF C1), Anglais (TOEIC 825/990), Espagnol (notions).
L'arabe est retiré à la demande de Taha.

Conséquence : **aucun drapeau de visibilité à ajouter** sur la table `langues`.
Migration annulée.

### Accroche

L'accroche générique du volet (`accroches`, `offre_id` nul, `validee` vraie).
L'accroche personnalisée par offre est reportée à l'étape 5, avec la lettre :
même travail de rédaction, même risque d'invention.

### Stockage et écrans

Chaque CV généré est enregistré dans `documents` avec l'offre, le volet, la
date et le contenu. Regénérer **ajoute une version**, ne remplace pas.

- Fiche d'offre analysée : bouton **Générer le CV**, puis aperçu et
  téléchargement.
- Page **Mes CV** : liste des CV générés, avec leur offre et l'historique des
  versions.

## Risque technique identifié

React-PDF ne signale pas un débordement avant d'avoir composé le document. La
parade retenue est une estimation par comptage de caractères avant rendu, avec
repli sur le quota inférieur. C'est une heuristique : le seuil devra être
ajusté sur les premiers CV réels.

---

## Amendements validés le 8 septembre 2026, à l'implémentation

Quatre points ont été tranchés après les premières mesures sur les vraies
données. Ils modifient la spécification ci-dessus.

### 1. Une page, strictement

La contrainte d'une page l'emporte sur les quotas. Les mesures ont montré que
la cible et son unique repli ne libèrent qu'une vingtaine de points, très
insuffisant pour garantir quoi que ce soit.

L'échelle de compacité est prolongée à six crans, du plus généreux au plus
serré :

| Cran | Missions | Compétences |
|---|---|---|
| 0 | 4 / 4 / 3 / 3 | 10 |
| 1 | 4 / 3 / 3 / 3 | 10 |
| 2 | 4 / 3 / 3 / 3 | 9 |
| 3 | 3 / 3 / 3 / 3 | 9 |
| 4 | 3 / 3 / 2 / 2 | 8 |
| 5 | 3 / 2 / 2 / 2 | 7 |

L'estimation par comptage de caractères choisit le premier cran ; **la
composition réelle a le dernier mot**. Le nombre de pages effectivement
produit est relu après rendu, et le générateur redescend d'un cran tant qu'il
dépasse. Si même le cran 5 déborde, aucun CV n'est enregistré et le message
indique quoi raccourcir. Le cran appliqué est toujours affiché.

### 2. Le cœur de métier passe en tête des compétences

Une offre réclame « Contrôle de gestion » ou « Comptabilité » : un métier
entier, qu'aucune ligne de compétence ne contient littéralement. Sans
rattrapage, le cœur du métier passait derrière Excel et Power BI.

La sélection reprend donc le rattrapage par famille déjà présent dans le
barème de l'étape 3, en le conditionnant au niveau acquis : une famille dont
le niveau déclaré est « notions » ne double pas une exigence nommément citée
et maîtrisée.

### 3. L'arabe est supprimé

Fait en base le 8 septembre 2026, avec renumérotation de l'ordre. Le niveau
de la ligne « Français » est vidé : la certification DALF C1 en tenait déjà
lieu et l'affichage était redondant.

### 4. Les périodes discontinues sont décrites comme telles

Migration `0003_periodes_experience.sql` : table `experience_periodes`.

Une expérience regroupée peut couvrir plusieurs séjours qui ne se suivent pas.
Les colonnes `date_debut` / `date_fin` ne savent exprimer qu'un intervalle
continu, ce qui annonçait « Juin 2019 – Août 2022 » pour quatre mois
travaillés. Le CV affiche désormais **« Juin 2019 & Juin – Août 2022 »**.

Quand la table est vide pour une expérience, rien ne change : la période reste
`date_debut → date_fin`. Le calcul d'ancienneté n'est pas modifié : il
continue de lire `duree_mois_forcee`, dont la valeur (4 mois) coïncide avec la
somme des périodes saisies. Aucun score ne bouge.
