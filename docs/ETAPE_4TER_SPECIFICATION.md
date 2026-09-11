# Étape 4ter — Corpus d'expérience

Spécification à valider avant toute ligne de code.
Rédigée le 11 septembre 2026.

---

## Le problème

Une offre de bailleur social réclamait régularisation des charges, quotes-parts,
clés de répartition. Taha a fait tout cela chez Le Mans Métropole Habitat. Le
CV n'en dit rien, la reformulation n'a rien pu produire, et l'indicateur de
potentiel a crié « fort » sans distinguer ce qui manquait au CV de ce qui
manquait au parcours.

La base ne contient que vingt-six missions, extraites de deux CV — donc d'un
texte déjà comprimé pour tenir sur une page. Tout ce qui n'a pas survécu à
cette compression a disparu.

Cette étape rend cette matière à l'application. **Sans demander de classer quoi
que ce soit** : Taha ne trie pas entre mission, sous-mission et détail. L'offre
décide, le modèle propose, Taha valide.

---

## Décisions

### D36 — Une table `corpus_experience`

Rattachée à une expérience, elle porte ce qui a été fait, avec ses codes
d'activité et son vocabulaire. Ce n'est **pas** une liste de missions
candidates au CV : aucune ligne du corpus n'est jamais sélectionnée pour un CV.
C'est de la matière première.

Colonnes : `experience_id`, `texte`, `activites_codes`, `volets`, `source`,
`ordre`. Migration `0005`.

**Seize entrées validées le 11 septembre 2026** pour Le Mans Métropole Habitat,
tirées des documents de travail : mode opératoire des écarts de quittancement,
rapprochement comptabilité / régularisation, retraitements, qualification des
écarts, entretiens avec l'Unité Charges et Contrats, procédure mensuelle de
quittancement en neuf étapes, contrôle en environnement de test, charges sans
loyer, points de vigilance, synthèse des prélèvements, tableaux de bord
Patrimoine et Gestion locative, vacance et rotation, indicateurs de gestion
locative, projection de quittancement, modèle de prix de vente minimum,
rapprochement loyers / RLS / grille de vente.

### D37 — Le potentiel mesure ce qui est mobilisable

L'indicateur distingue désormais deux catégories :

- **Récupérable** — le terme de l'annonce est absent du CV mais ancré dans le
  corpus, les formations ou les compétences. Une reformulation ou une nouvelle
  mission peut le faire apparaître.
- **Hors portée** — le terme n'existe nulle part dans le parcours. Rien à en
  faire, et c'est très bien : un CV n'a pas à couvrir toutes les annonces.

Seul le récupérable détermine le niveau affiché. Le hors-portée est listé
séparément, à titre d'information.

### D38 — La reformulation peut puiser dans le corpus

Le contrôle de l'étape 4bis rejette tout terme absent de la mission d'origine.
C'est ce qui empêchait « clés de répartition » d'apparaître.

Nouvelle règle : un terme est autorisé s'il est ancré **dans le corpus de la
même expérience**. Le contrôle reste strict sur le reste — chiffres, sigles
perdus, nominalisations — et **rien ne migre d'un employeur à l'autre** : le
corpus de LMMH n'autorise rien dans une mission TECHNICAPS.

### D39 — Le modèle peut proposer des missions nouvelles

Quand une offre réclame quelque chose que le corpus couvre et qu'aucune mission
n'exprime, le modèle rédige une mission à partir du corpus de l'expérience
concernée.

Elle est présentée dans le même écran que les reformulations, avec les extraits
de corpus qui la fondent. Acceptée, elle **rejoint la base** et sert à toutes
les offres suivantes ; la sélection par offre fera le tri, c'est son métier.

Le contrôle vérifie que chaque fait avancé est ancré dans le corpus de cette
expérience. Aucune proposition non ancrée n'est montrée sans motif.

### D40 — Les propositions écartées restent visibles et acceptables

L'écran affichait « 12 écartées par le contrôle » sans dire lesquelles. Elles
sont désormais listées, repliées, avec leur motif de rejet en clair.

Chacune peut être acceptée. Quand le motif est une **invention** — chiffre ou
outil ajouté — l'acceptation est signalée en rouge avec le motif explicite.
Taha est l'auteur du document et sait ce qui est vrai ; il le saura en le
faisant.

---

## Hors périmètre

- Tout classement manuel entre mission, sous-mission et détail
- Le changement de statut des offres — étape 6
- L'ajout automatique d'une mission sans validation

---

## Points ouverts

| # | Question | Proposition |
|---|---|---|
| D36 | Le corpus est-il visible et modifiable dans Mon profil ? | Oui, en lecture et suppression |
| D39 | Combien de propositions de missions par offre au maximum ? | Trois |
