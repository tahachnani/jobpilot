# Étape 4bis — Reformulation des missions par offre

Spécification à valider avant toute ligne de code.
Rédigée le 9 septembre 2026.

---

## Le problème

L'étape 4 choisit **quelles** missions apparaissent et dans **quel ordre**, mais
le texte qui sort du PDF garde les mots de la base, mot pour mot.

Si l'offre réclame « participation à l'élaboration budgétaire » et que la
mission dit « élaboration et mise à jour des tableaux de bord budgétaires », la
mission est bien sélectionnée — les codes d'activité se recoupent — mais
l'expression exacte de l'annonce n'apparaît nulle part dans le document. Un
analyseur de CV qui cherche ses propres termes ne les trouve pas.

Cette étape comble cet écart, sans jamais laisser une IA inventer un fait.

---

## Le principe directeur

> **Une reformulation redit la même chose avec le vocabulaire de l'annonce.
> Elle n'ajoute rien.**

Pas un chiffre, pas un outil, pas une responsabilité, pas un périmètre, pas une
compétence qui ne soit déjà dans la mission d'origine. Une reformulation qui
enrichit le contenu est un mensonge sur un document signé — le fait qu'elle
soit flatteuse la rend plus dangereuse, pas moins.

Trois garde-fous, dans cet ordre :

1. **Un contrôle automatique** rejette les reformulations qui introduisent un
   élément absent de l'original. Déterministe, sans IA.
2. **Une validation humaine** : original et proposition côte à côte, acceptation
   mission par mission.
3. **Rien de non validé n'entre jamais dans un CV.**

---

## Décisions

### D19 — Où vivent les reformulations

Dans `mission_formulations`, avec `offre_id` renseigné et
`origine = 'ia_reformulee'`. Aucune migration : la table porte déjà ces
colonnes et la contrainte `origine_connue` accepte déjà cette valeur. Aucune
contrainte d'unicité n'empêche plusieurs formulations pour un même couple
mission / volet.

Le drapeau `validee` fait foi : `false` à la génération, `true` après ton
accord.

### D20 — Ce que le générateur retient

Pour une offre donnée, l'ordre de préférence devient :

1. formulation liée à **cette offre**, `validee = true`
2. formulation générique du volet
3. formulation générique de l'autre volet (emprunt, règles inchangées)

Le générateur écarte aujourd'hui toute formulation portant un `offre_id`. Cette
règle est levée pour l'offre courante uniquement — une reformulation écrite
pour une annonce ne contamine jamais une autre candidature.

### D21 — Sur quelles missions

Uniquement les missions **retenues par la sélection** — quatorze au maximum,
souvent moins. Reformuler la base entière coûterait cher pour du texte qui ne
sortira pas.

**À trancher :** faut-il en plus filtrer sur l'écart de vocabulaire, et ne
reformuler que les missions dont les mots diffèrent réellement de ceux de
l'annonce ? Cela réduit le coût et le volume à relire, mais ajoute un seuil
arbitraire de plus.
*Proposition : reformuler les quatorze, et laisser le contrôle automatique
écarter les propositions qui n'apportent rien.*

### D22 — Le contrôle automatique

Exécuté sur chaque proposition, avant de te la montrer. Sans IA.

Une reformulation est **rejetée d'office** si elle :

- introduit un **nombre** absent de l'original (18000, 5-10 %, N/N-1…)
- perd un nombre présent dans l'original
- introduit un **nom propre ou un outil** absent de l'original (SAP, Power BI,
  CODIR, ULIS…), reconnu par majuscule initiale ou par la liste de tes
  compétences de catégorie outil
- dépasse la longueur de l'original de plus de 20 %
- est identique à l'original

Une proposition rejetée n'est pas montrée : la formulation d'origine reste.

### D23 — La validation

Un écran par offre, listant les missions retenues. Pour chacune : l'original et
la proposition **côte à côte**, avec les différences visibles. Trois actions
possibles — accepter, refuser, modifier le texte à la main.

Le CV ne peut être régénéré avec reformulations que sur les missions acceptées.
Les autres gardent leur formulation d'origine.

### D24 — La promotion vers la base

Une reformulation acceptée peut être **adoptée comme formulation de référence
du volet**, et servira alors à toutes les offres suivantes.

**À trancher :** que devient l'ancienne formulation générique ?
*Proposition : elle est conservée, `validee` passé à `false`, afin de pouvoir
revenir en arrière. Rien n'est jamais supprimé.*

### D25 — Le déclenchement

**À trancher :** la reformulation part-elle automatiquement à la génération du
CV, ou par un bouton distinct ?
*Proposition : un bouton distinct.* Générer un CV est aujourd'hui gratuit et
instantané ; y greffer un appel IA rendrait chaque clic payant et lent. La
reformulation devient une action délibérée, sur les offres qui comptent.

### D26 — Le modèle et le coût

Claude Haiku, comme l'extraction d'offre. Un seul appel pour l'ensemble des
missions d'un CV, pas un appel par mission.

Le coût est enregistré dans `documents.cout_usd`, déjà prévu à cet effet.

### D27 — Le déterminisme est préservé

Une fois les reformulations validées, la génération du CV reste entièrement
déterministe : elle ne fait que lire des textes stockés. Même offre, même
profil, même CV. Régénérer reste gratuit.

L'IA n'intervient qu'au moment de la reformulation, jamais à la composition.

---

## Hors périmètre

- La lettre de motivation et les emails — étape 5
- La reformulation de l'accroche par offre — étape 5, où elle a plus de sens
- La reformulation des compétences : ce sont des libellés courts et normalisés,
  les reformuler brouillerait le vocabulaire sans rien gagner
- Le changement de statut de l'offre — étape 6

---

## Points ouverts à trancher

| # | Question | Proposition |
|---|---|---|
| D21 | Filtrer sur l'écart de vocabulaire ? | Non, reformuler les quatorze |
| D24 | Sort de l'ancienne formulation générique | Conservée, `validee = false` |
| D25 | Déclenchement automatique ou bouton | Bouton distinct |
