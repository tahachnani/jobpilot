# La taxonomie éditable — décisions D74 à D77

Passe demandée le 23 septembre 2026, à partir d'un constat d'usage précis :

> « J'ai vu amélioration 0 alors que je faisais de l'amélioration et de la
> proposition de piste d'amélioration dans mes expériences, c'est pour ça que
> je voulais l'ajouter. »

---

## Pourquoi « amélioration continue » restait à zéro

Trois verrous, en série. Chacun aurait suffi.

1. **Le code n'existait pas.** La taxonomie vivait dans
   `src/config/activites.ts`, figée à la compilation : trente codes, aucun
   moyen d'en ajouter un sans redéployer.
2. **La saisie le refusait en silence.** `codesValides()` filtrait sur
   `ACTIVITES` et **laissait tomber** ce qui n'y figurait pas, sans un mot.
   L'entrée de corpus du 23 septembre à 17 h 38 a donc été enregistrée avec
   `activites_codes: []`. Rien à l'écran ne l'a dit.
3. **Le corpus ne note rien.** Même avec un code valide, une entrée de corpus
   ne pèse sur aucun score : le calcul lit les codes des **missions**. Le
   corpus autorise un terme en reformulation et mesure ce qui est récupérable,
   c'est tout — et ce n'était écrit nulle part.

Et un quatrième, découvert en réparant : **les codes d'une mission étaient en
lecture seule** dans « Mon profil ». Ouvrir la taxonomie sans cela n'aurait
servi à rien — on aurait pu créer le code, jamais l'affecter.

---

## D74 — La liste reste fermée, c'est toi qui la fermes

Le scoring ne compare pas des phrases : il classe dans une liste fermée, puis
compte des codes communs. C'est ce qui rend une note reproductible, et cela ne
change pas. Ce qui change, c'est **où vit la liste**.

La table `activites` devient la vérité du moteur. `src/config/activites.ts`
garde deux rôles, et deux seulement : il **amorce** la table à la migration
0011, et il sert de **repli** si celle-ci est vide ou inatteignable — un score
doit rester calculable, même une migration en retard.

La taxonomie est relue à chaque calcul, chaque extraction, chaque écran :
aucune mémoire entre deux appels. Modifier la liste puis renoter dans la foulée
doit donner le score de la nouvelle liste, pas celui d'un cache. Trente lignes
se relisent pour rien.

**Un onglet « Taxonomie »** dans le menu. On y ajoute un code, on y corrige un
libellé, une famille, un ordre, et on y met un code hors service.

- Le **code** est un identifiant et ne se renomme pas. Il est recopié tel quel
  dans les missions, le corpus et les analyses d'offres déjà payées : le
  renommer rendrait ces lignes muettes sans prévenir. Pour changer de code, on
  en crée un autre et on réaffecte — ce qui est visible, donc réparable.
- Le **libellé** se corrige librement : c'est ce qui s'affiche.
- Un code **hors service** n'est plus proposé au modèle ni à la saisie, mais le
  moteur continue de le comprendre. C'est une retraite, pas un effacement : les
  missions qui le portent gardent leur sens.
- Un code **porté par au moins une ligne ne se supprime pas**. L'écran dit
  combien de missions et d'entrées de corpus le portent. Supprimer sans ce
  garde-fou ferait sortir ces lignes du calcul au recalcul suivant, sans que
  rien ne l'annonce.
- L'écran signale aussi l'inverse — un code **porté par la base mais absent de
  la liste**. Ces lignes-là ne comptent dans aucun score, et rien ne le disait.

**Les codes des missions deviennent modifiables** dans « Mon profil », sous
chaque mission, avec la même liste de suggestions que le corpus. C'est le seul
endroit où l'on agit sur ce que le score compare.

**Toute modification incrémente la version du barème.** Les scores d'avant et
d'après ne sont pas comparables ; la version les distingue, comme pour une
retouche des poids, et chaque écran de confirmation renvoie vers « Renoter tes
offres » — aucun appel IA, aucun coût.

## D75 — Un code refusé se dit

Le filtre muet est remplacé. Un code hors taxonomie n'est plus écarté en
silence : il est **rendu à l'appelant**, qui l'affiche, avec le lien vers
l'onglet Taxonomie pour le créer. Le reste de la saisie est enregistré.

Un filtre qui se tait transforme une saisie en perte de données. Celui-ci a
coûté une soirée à chercher la panne ailleurs.

Un code hors service, lui, reste recevable à la saisie : le champ est prérempli
avec l'existant, et un simple réenregistrement ne doit pas effacer ce qui est
déjà là.

## D76 — Le corpus ne compte pas dans le score

Dit une bonne fois, à l'endroit où l'on est tenté de croire le contraire : le
bloc « Corpus » de chaque expérience porte désormais la phrase. Le calcul lit
les codes des missions, pas ceux du corpus. Un code posé seulement dans le
corpus reste à zéro dans la note d'une offre.

Aucun code n'est modifié pour cela : c'est une lacune d'interface, pas de
moteur. Le corpus garde exactement le rôle qu'il a toujours eu.

## D77 — Réanalyser une offre

Constat du 24 septembre, une fois la taxonomie ouverte. Une offre analysée le
22 septembre affichait toujours « Proposition d'actions d'amélioration
continue — hors calcul », alors que le code existait désormais. Plusieurs
recalculs n'y ont rien changé, et c'était normal : **la taxonomie sert au
moment où l'annonce est lue, pas au moment où elle est notée.** Le recalcul
rejoue l'arithmétique sur une classification figée le jour de l'ajout.

Vérifié dans les données avant de conclure : l'offre ajoutée juste après la
création des codes porte `amelioration_continue` et `controle_interne`, sans
une seule ligne non classée. Le mécanisme fonctionnait ; il manquait le
chemin pour en faire profiter l'existant.

Car l'extraction n'existait qu'à **l'ajout** d'une offre, où le contrôle
anti-doublon sur l'empreinte du contenu renvoie vers l'offre existante sans
rien relancer. Une offre analysée l'était donc pour toujours.

Le bouton « Réanalyser l'offre » rappelle le modèle sur le `contenu_brut` déjà
stocké — rien à recoller —, écrit une nouvelle analyse et renote. Il annonce
son coût et demande confirmation : c'est le seul bouton de ce bloc qui
dépense, environ un centime.

Trois prudences le distinguent d'un simple « refaire » :

- **L'analyse précédente est conservée.** Une réanalyse peut être moins bonne
  que celle qu'elle remplace ; on doit pouvoir comparer, et le coût déjà payé
  ne disparaît pas parce qu'on recommence.
- **Le statut ne bouge pas.** Réanalyser n'est pas revenir en arrière : une
  candidature envoyée le reste (D43).
- **Un champ que la nouvelle lecture ne retrouve pas n'écrase pas l'ancien.**
  Une réanalyse ne doit pas effacer ce qu'elle ne sait plus lire.

L'écran annonce le résultat par la seule mesure qui dise si l'opération a
servi : le nombre de lignes hors calcul avant et après.

Portée réelle mesurée le 24 septembre : 9 lignes non classées sur 305, réparties
sur 7 offres, dont 4 relèvent des codes ajoutés depuis. Les cinq autres — la
veille réglementaire, par exemple — ne sont pas des activités du parcours et
doivent rester hors calcul. « Hors calcul » n'est pas toujours un défaut de la
taxonomie.

---

## Ce que cette passe ne change pas

Le calcul lui-même est intact : mêmes poids, mêmes formules, mêmes règles
qu'après D64–D73. La taxonomie est **passée en paramètre** à `calculerScore`,
exactement comme le barème l'était déjà, avec le socle pour valeur par défaut.
Aucun test existant n'a eu à changer.

Les synonymes, la détection automatique d'un code manquant à partir des lignes
non classées, et la fusion de deux codes ont été écartés : chacun demande une
décision à part.

---

## Migration

`0011_taxonomie.sql` — table `activites`, RLS, déclencheur d'horodatage, et
l'amorçage des trente codes du socle. Idempotente, et son `insert` est en
`on conflict do nothing` : la relancer n'écrase pas un libellé corrigé depuis
l'écran.

Tant qu'elle n'est pas lancée, l'application tourne sur le socle versionné et
l'onglet Taxonomie le dit en rouge, en toutes lettres. Rien n'est cassé, rien
n'est modifiable.

## Tests

Huit cas ajoutés : la normalisation d'un libellé en code, la recevabilité d'un
code, la complétude du socle de repli, le double statut d'un code hors service
— plus proposé, toujours compris —, et deux cas de bout en bout vérifiant
qu'un code absent du fichier versionné est bel et bien pris en compte quand il
est dans la liste passée au moteur. Sans ces deux-là, on aurait déplacé la
source sans changer le comportement.

Soixante et onze tests au total, tous au vert.

## Après le déploiement

1. Lancer `0011_taxonomie.sql` (avec `0009` et `0010` si ce n'est pas fait —
   `0010` **seule**, `add value` n'accepte pas d'être dans une transaction).
2. Onglet Taxonomie → ajouter « Amélioration continue », famille Transverse.
3. « Mon profil » → affecter `amelioration_continue` aux trois missions
   concernées.
4. Paramètres → « Recalculer tous les scores ».
