# Sept améliorations — décisions D64 à D70

Passe demandée le 21 septembre 2026, après un constat d'usage : **presque
toutes les offres analysées obtenaient plus de 70 %**.

---

## Le diagnostic, avant les corrections

Mesuré sur les cinq offres alors notées avec le barème courant : des scores de
**73 à 84**, onze points d'amplitude. Trois causes, toutes vérifiées dans les
données :

1. **Une mission de l'annonce était « couverte » dès qu'un seul code
   d'activité était partagé** avec une des 33 missions du parcours. Comme
   celui-ci couvre à peu près toute la taxonomie du contrôle de gestion, une
   offre du métier trouvait un code commun pour presque chaque ligne : moyenne
   83, avec un 97. Le score répondait en réalité à « est-ce bien une offre de
   contrôle de gestion ? ».
2. **Trois valeurs neutres hautes** remontaient mécaniquement tous les scores :
   70 pour une mission sans code, 70 pour une offre sans compétences
   explicites, 75 pour une offre ne chiffrant aucune expérience. Sur ces cinq
   offres, quatre étaient dans ce dernier cas : **trente-cinq pour cent du
   score était une constante à 75**, sur le sous-score que D42 avait pourtant
   alourdi pour discriminer.
3. **Le profil se notait lui-même** : 93 des 146 compétences venaient
   d'annonces, acceptées au niveau 2 par défaut, dont 39 purement
   comportementales. Plus on analysait d'offres, plus le profil « connaissait »
   de choses, plus le sous-score compétences montait — et moins une offre
   pouvait signaler un manque.

---

## D64 — Le niveau du poste, et non son seul thème

Un poste de contrôleur de gestion junior mono-site et une responsabilité du
contrôle de gestion groupe sur douze filiales partageaient les mêmes codes
d'activité, donc la même note.

L'extraction retient désormais trois champs de plus : `seniorite` (junior,
confirmé, senior, responsable), `encadrement` (nombre de personnes, seulement
s'il est écrit) et `perimetre` (ce que l'annonce dit de l'étendue du poste :
entités, sites, budget suivi). Le modèle a consigne de ne rien deviner à partir
du seul intitulé.

Quand l'annonce ne dit rien, `src/lib/seniorite.ts` déduit le niveau, dans cet
ordre strict : mention explicite, puis encadrement annoncé, puis intitulé, puis
durée d'expérience demandée. **La provenance est toujours affichée** — un
niveau deviné ne doit pas se faire passer pour un niveau lu.

Ce niveau sert à noter l'expérience quand aucune durée n'est chiffrée :
junior 0 an, confirmé 3, senior 5, responsable 7. Ce ne sont pas des seuils du
marché, ce sont les valeurs qui permettent de mesurer au lieu d'inventer une
note neutre.

## D65 — Le vocabulaire départage ce que le code ne distingue pas

La plupart des missions d'annonce ne portent qu'un seul code : le taux de
recouvrement ne valait donc que 0 ou 100. On mesure en plus la part des mots
significatifs de l'exigence qui se retrouvent dans la mission du parcours, et
la note est multipliée par un facteur allant de 0,6 à 1.

Le plancher de 0,6 est délibéré : partager un code d'activité reste une
couverture réelle, même dite avec d'autres mots. Une mission couverte
thématiquement mais sans aucun terme commun tombe à 60 au lieu de 100.

## D66 — Un critère non mesurable sort du calcul

Les trois valeurs neutres disparaissent. Un critère que l'annonce ne permet pas
d'évaluer porte désormais `mesurable: false`, **son poids est redistribué sur
les autres**, et le poids affiché à l'écran est le poids réel dans ce score —
pas celui du barème. Une ligne de mission non classée ne compte plus ni en bien
ni en mal.

Le résultat expose `criteresEcartes` : un score calculé sur deux critères ne
vaut pas un score calculé sur quatre, et l'écran peut le dire.

## D67 — Le profil cesse de se noter lui-même

Une compétence acceptée depuis une offre entre au **niveau 1** — des notions —
et non plus 2. À toi de la monter si tu la tiens vraiment.

« Mon profil » reçoit un bloc de ménage sur les compétences venues d'annonces,
avec trois entrées : les qualités plutôt que savoir-faire, repérées par
`estSavoirFaire` ; les doublons probables, groupés par les trois premiers mots
normalisés du libellé ; et la liste complète. Sélection multiple, suppression
en un clic. La suppression est définitive mais sans effet sur les CV déjà
générés, qui portent leur propre modèle figé.

## D68 — Le barème confronté aux réponses reçues

Le score est une hypothèse tant qu'aucune candidature n'est partie. La page
Candidatures affiche, dès deux issues connues, la note moyenne des offres selon
leur issue — entretien, refus, sans réponse — avec le nombre de cas.

Aucun calcul savant, et l'échantillon est affiché tel quel : en dessous d'une
dizaine d'issues, l'écart ne veut rien dire, et l'écran le dit. Si les
entretiens ne se distinguent pas des refus, c'est le barème qu'il faut revoir.

## D69 — Le marché caché, ouvert plutôt qu'entrouvert

La page était annoncée dans le menu depuis l'étape 1, avec un badge « V1.1 »,
et n'a jamais rien contenu.

Elle tient désormais la liste des entreprises visées sans qu'elles publient
d'annonce : nom, secteur, taille, localisation, contact obtenu, raison de les
viser, et l'état de la démarche — à qualifier, à contacter, contactée,
relancée, en discussion, sans suite, écartée. La date du premier contact est
posée automatiquement au premier changement d'état vers « contactée ».

**Rien n'est collecté automatiquement** : ni annuaire, ni moissonnage, ni
contact acheté. La liste est celle que tu constitues, et les contacts que tu y
notes sont ceux que tu as obtenus toi-même.

## D70 — La préparation d'entretien

Le statut « Entretien » existait depuis l'étape 1 et ne déclenchait rien. Or à
ce moment l'application détient l'annonce, le CV exactement tel qu'il est
parti, la lettre, et surtout **les écarts qu'elle a elle-même mesurés** — ce
que le recruteur va justement chercher.

La fiche contient : ce que le poste attend en une phrase, six questions
probables au maximum avec ce sur quoi s'appuyer, trois fragilités tirées des
écarts mesurés avec la façon de les aborder, cinq faits du parcours à avoir en
tête, et trois questions à poser.

Deux règles la distinguent de la lettre. Elle **ne rédige aucune réponse toute
faite** : elle nomme la mission ou le chiffre sur lequel s'appuyer, et c'est
toi qui formules — une réponse apprise par cœur s'entend. Et elle ne minimise
aucun écart : un écart s'aborde de front, avec ce qui le compense.

Elle est disponible dès qu'un CV existe, mise en avant au statut « Entretien »,
et ne change aucun statut : préparer n'est pas passer l'entretien.

---

## D71 — La virgule n'est pas un séparateur de compétences

Constat du 22 septembre, sur une offre réelle. L'extraction avait produit deux
libellés parfaitement corrects :

- « Expérience en environnement industriel, R&D ou grand groupe »
- « Dispositifs de financement de l'innovation (CIR, subventions, brevets) »

L'écran les proposait à l'ajout en **quatre lignes** : « R&D ou grand groupe »,
« Dispositifs de financement de l'innovation (CIR », « Subventions »,
« Brevets) » — parenthèses cassées comprises. C'était `decouperLibelle` qui
coupait sur toutes les virgules, y compris à l'intérieur des parenthèses.

Le découpage ne se fait plus que sur le **slash** et le **point-virgule**, et
jamais sur un libellé qui contient une parenthèse : dans une annonce, la
virgule énumère aussi souvent des exemples que des compétences distinctes, et
rien ne permet de trancher. Le prix est assumé — « Reporting, budget,
forecast » restera d'un bloc — et vaut mieux qu'un profil rempli de moitiés de
phrases.

Deux règles s'ajoutent au prompt d'extraction pour tarir la source : un type
d'entreprise ou un contexte de travail n'est pas une compétence, et une
parenthèse d'exemples reste attachée à son libellé.

Sept tests figent ces cas, tirés d'offres réelles.

---

## D72 — Un libellé d'annonce n'est pas un libellé de CV

D71 avait réparé le découpage ; restait le fond. Une annonce écrit « Appétence
pour les systèmes d'information », « Expérience en environnement industriel »,
« Capacité à respecter les délais ». Repris tels quels, ces libellés entraient
dans la base et pouvaient finir sur un CV. Deux cas, deux traitements.

**Ce qui n'est pas une compétence est écarté de l'ajout.** Une exigence de
contexte — secteur, type d'entreprise, diplôme, première expérience — est
désormais détectée et affichée dans un bloc à part, « Exigences de contexte »,
en lecture seule. Elle dit quelque chose du poste, mais elle ne se revendique
pas comme un savoir-faire : une expérience sectorielle se lit dans les
employeurs du CV, pas dans une ligne de compétence — et le sous-score
« secteur » la mesure déjà.

**Ce qui est une compétence se reformule avant d'entrer.** Le libellé proposé
n'est plus un texte figé mais un **champ modifiable**, pré-rempli du libellé
nettoyé. Deux valeurs circulent donc : celui de l'annonce, qui sert à ne pas
reproposer la même ligne, et celui que tu as corrigé, qui entre en base. Le
nettoyage automatique retire aussi les tournures d'expérience :
« Expérience significative en contrôle de gestion » devient « Contrôle de
gestion ».

Dix tests couvrent ces cas, dont la liste des contextes tirée d'annonces
réelles.

---

## Migrations

- `0009_entreprises_cibles.sql` — table `entreprises_cibles`, énumération
  `demarche_cible`, RLS et déclencheur d'horodatage.
- `0010_type_preparation.sql` — ajoute `preparation` à `type_document`. **À
  lancer seule** : `add value` n'accepte pas d'être dans une transaction.

## Barème

La version passe à **5**. Toutes les offres sont à renoter depuis Paramètres :
aucun appel IA, aucun coût. Le recalcul suffit aussi à faire bénéficier les 29
analyses existantes de la séniorité déduite — celle-ci se lit dans l'intitulé,
déjà stocké, sans repasser par le modèle.

## Ce que cette passe ne fait pas

Le score relatif entre offres, les filtres salaire et localisation, et le
rapprochement des annonces en double ont été écartés. La sélection des
missions du CV, le contrôle de reformulation et la composition du PDF ne sont
pas touchés.
