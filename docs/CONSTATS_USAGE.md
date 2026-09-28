# Neuf constats d'usage — décisions D78 à D86

Passe du 28 septembre 2026, après deux semaines d'usage réel : 67 offres
analysées, 42 candidatures envoyées, 9,66 $ dépensés. Ce ne sont plus des
hypothèses de conception, ce sont des choses vues.

---

## D78 — Le potentiel dit d'où vient chaque terme

> « Souvent j'ai un potentiel fort d'adaptation et aucune nouvelle mission à
> proposer. »

Les deux indicateurs ne mesuraient pas la même chose, et un seul mot les
faisait passer pour contradictoires.

Le potentiel regardait les termes de l'annonce absents du CV et les cherchait
dans **quatre sources** : les entrées de corpus, les missions que le quota
n'avait pas retenues, les compétences, les formations. Un terme trouvé
n'importe où était « récupérable », et un quart de récupérable suffisait à
afficher « fort ».

Les missions proposées, elles, ne peuvent naître que du **corpus**, et du
corpus de l'expérience concernée. Trois sources sur quatre promettaient donc
une action que rien ne pouvait réaliser.

Chaque source est désormais affichée à part, avec ce qu'elle autorise :

- **corpus** — une mission peut être proposée, c'est le seul cas où payer une
  génération a un sens ;
- **mission non retenue** — elle existe déjà, elle a perdu la course au quota ;
- **compétence** — tu le revendiques ailleurs, rien à générer ;
- **formation** — le diplôme le dit déjà.

Le niveau ne compte plus que le corpus, et **en valeur absolue** : trois termes
pour « fort » — le plafond de propositions du générateur —, un ou deux pour
« moyen ». Une part n'aurait rien voulu dire ; ce qui décide, c'est la quantité
de matière disponible pour écrire une mission.

La **couverture reste inchangée**, à la demande : elle répond à une autre
question — combien de ce que l'annonce réclame est déjà sur le CV — et cette
question-là ne dépend d'aucune source.

`documents.selection` passe au **schéma 4**. Un document est figé le jour de sa
génération : ceux d'avant n'ont pas la ventilation, et l'écran le dit au lieu
de l'inventer.

## D79 — La reformulation avertit avant de coûter

Deux problèmes distincts, souvent confondus.

**Le premier est un problème d'argent**, et il n'a qu'une solution. L'appel est
facturé avant tout filtrage : durcir le contrôle n'économise pas un centime,
seul le fait de ne pas cliquer le fait. Quand aucun terme de l'annonce n'est
dans le corpus, le bouton l'annonce, passe en gris et demande une confirmation
qui chiffre la dépense. Il ne bloque pas : il arrive qu'on ait une raison.

**Le second est un problème de qualité.** La règle existante exigeait qu'une
reformulation fasse entrer un terme de l'annonce — et il suffisait d'en glisser
un pour être accepté, quitte à réécrire tout le reste. « Suivi chaque semaine
des résidences à enjeux » devenait « Pilotage hebdomadaire du patrimoine
sensible » : un terme gagné, quatre perdus, et des mots que l'original disait
mieux.

Une reformulation doit **ajouter**, pas **échanger**. Ce qui disparaît était
vrai et lisible par un analyseur de CV. On tolère une perte de plus que
d'apports — une reformulation resserre parfois — et pas davantage. Le rejet
n'est jamais définitif : la proposition reste affichée avec son motif et
s'accepte à la main.

## D80 — La lettre, plus courte et sans exhibition

Trois changements, tous demandés.

**La longueur.** 2 367 signes en moyenne, jusqu'à 3 049. Le plafond passe à
2 000 signes, avec un budget indicatif par paragraphe — 350, 700, 600, 300 —
parce qu'un modèle tient mieux quatre contraintes locales qu'un total global.

**Les diplômes.** Interdiction d'écrire que le candidat détient deux masters :
le cumul ne prouve rien et se lit comme une exhibition ; le CV le dit déjà.
Interdiction de nommer un établissement, et « Le Mans Université » en
particulier : la candidature vise toute la France, et nommer une université
régionale ancre le profil là où il ne veut pas l'être. Si la formation doit
apparaître, elle apparaît par sa spécialité.

**La réécriture qui ne réécrivait rien.** Deux causes. Le style était tiré au
sort parmi quatre : une chance sur quatre de retomber sur le même. Et on
demandait au modèle de ne pas reprendre les tournures d'une version **qu'il
n'avait jamais vue**. Le style tourne maintenant avec le numéro de version, la
lettre précédente est fournie, et les quatre consignes se contredisent entre
elles — un style qui n'interdit rien ne change rien.

## D81 — Candidatures répond à une seule question

La fiche d'offre répond à « que vaut cette offre ». L'écran Candidatures doit
répondre à **« qu'est-ce que je dois faire aujourd'hui »**, et tout ce qui ne
sert pas cette question est du bruit.

La carte ne porte plus que l'essentiel — statut, date d'envoi, ancienneté,
relance prévue, score, origine — et deux portes explicites : **voir le CV
envoyé**, qui ouvre le PDF réellement parti, et **ouvrir l'offre**, où vit
tout le reste. La carte entière n'est plus un lien : deux destinations
différentes méritent deux boutons.

L'ordre change aussi. Quarante-deux candidatures rangées par date ne se lisent
plus comme une liste mais comme une file d'attente : les relances dues d'abord,
puis les entretiens, puis l'attente, puis le reste — et à l'intérieur de chaque
rang, la plus ancienne en tête, parce que c'est elle qu'on oublie.

## D83 — Relancer là où l'on peut vraiment

> « Je postule sur des sites et je n'ai pas les e-mails des RH. »

C'est exact, et la réponse n'est pas technique. Sur la plupart des plateformes,
la relance passe par leur messagerie ; sur LinkedIn, par une personne. Deviner
une adresse est un pari, et une relance tombée dans un spam n'apporte rien.

La date de relance garde son rôle de pense-bête, mais la candidature porte
désormais un **canal** — messagerie de plateforme (par défaut), LinkedIn,
email, téléphone — et le texte généré s'y plie : quatre lignes sans objet pour
un message LinkedIn, quinze avec formule d'appel pour un email, un aide-mémoire
parlé pour un appel téléphonique.

## D84 — L'origine, à la place d'un commentaire vide

Le champ commentaire de l'envoi est resté vide sur quarante-deux candidatures :
au moment où l'on clique, on n'a rien à écrire. En revanche on sait toujours
d'où l'on a postulé.

Une liste fermée de seize origines — onze plateformes, cinq canaux hors
plateforme — remplace le champ libre. Ce n'est pas qu'une trace : croisée avec
les issues de D68, elle répond à la question qui décide où passer son temps.
Si trente candidatures APEC ne donnent aucun entretien et quatre candidatures
directes en donnent deux, le choix est fait.

Le commentaire, lui, **reste sur les changements de statut** : quand une offre
passe en entretien ou en refus, ce que le recruteur a dit vaut d'être noté, et
aucune liste ne le contiendra.

## D85 — « Mes CV » disparaît, son filet reste

L'écran faisait doublon avec la fiche d'offre, qui porte déjà les documents de
chaque candidature. Mais il a servi une fois, et sérieusement : c'est lui qui a
révélé que **54 CV sur 54 n'avaient aucun fichier stocké**, faute d'une règle
d'écriture sur le bucket. La fiche d'offre ne voyait rien, puisque le CV se
recompose à la demande.

La page part, le contrôle reste : Paramètres affiche le nombre de documents et
combien sont sans fichier, en rouge si ce n'est pas zéro.

## D86 — Un bouton nomme ce qu'il fait

Le composant de copie avait été écrit pour l'email puis réutilisé tel quel : la
lettre de motivation et la fiche d'entretien proposaient toutes deux « Copier
l'email ». Il prend désormais ce qu'il copie en paramètre. Un bouton qui nomme
autre chose que ce qu'il fait finit par être cru.

---

## Migration

`0012_origine_et_canal.sql` — colonnes `origine` et `canal_relance` sur
`offres`, plus un index par volet. **À lancer avant le déploiement** : le code
sélectionne ces colonnes, et une colonne absente ne casse pas une ligne, elle
vide un écran entier.

Texte libre plutôt qu'énumération : la liste des sites d'emploi bouge plus vite
qu'un schéma, et une valeur inconnue doit rester lisible plutôt que de faire
échouer une écriture. Le contrôle se fait côté application.

## Données reprises

- Les **cinq formulations comptables du CDD**, recopiées mot pour mot depuis le
  volet contrôle de gestion. L'expérience était visible en comptabilité depuis
  le 25 septembre sans aucune formulation dans ce volet : le plafond d'emprunt
  la réduisait à **une seule puce**, en haut de page.
- Les **vingt-cinq offres analysées** passées en « envoyée », date d'envoi égale
  à la date d'ajout, relance à dix jours. Elles arrivent donc toutes en retard :
  c'est le choix assumé de les voir plutôt que de les oublier.

## Ce que cette passe ne fait pas

La **préparation d'entretien avec recherche web** (D82) est écartée de ce lot,
à la demande. C'est la seule décision qui change la forme de l'appel API, et la
seule qui ne peut pas être vérifiée hors ligne ici. Elle sera traitée seule.

Le **marché caché** attend un prompt propre et des critères — périmètre
géographique, taille, secteur.

La **récupération des refus depuis la boîte mail** commence à la main, pour
éprouver les règles de rapprochement avant de décider si elles valent d'être
codées : domaine de l'expéditeur, date postérieure à l'envoi, intitulé du poste,
référence d'annonce. Aucune application automatique — deux offres chez le même
employeur se ressemblent trop.
