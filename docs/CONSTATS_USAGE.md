# Neuf constats d'usage — décisions D78 à D93

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

## D87 — Le tableau de bord se replie

Reprendre les vingt-cinq anciennes candidatures a fait apparaître vingt-cinq
relances dues le même jour. La rubrique « À relancer » poussait tout le reste
du tableau de bord sous la ligne de flottaison : indicateurs, refus, taux de
réponse, plus rien n'était visible.

La liste devient repliable. Le compte reste affiché — c'est lui l'information —
et le détail s'ouvre à la demande. Elle reste dépliée tant qu'il y a cinq
relances ou moins : en dessous de ce seuil, la liste *est* l'information.

## D88 — La fiche de candidature

D81 avait raison sur le principe et tort dans les faits. En allégeant la liste,
elle renvoyait vers la fiche d'offre pour la moindre action de suivi — préparer
un entretien, choisir un canal, déclarer une issue. Or ces gestes appartiennent
au suivi, pas à l'analyse de l'annonce, et l'aller-retour se payait à chaque
fois.

Chaque candidature retrouve donc **sa page**, sous `candidatures/`, qui porte
ce qui vient après l'envoi et rien d'autre : l'envoi (date, origine, canal,
interlocuteur), la relance (date, marquer relancée, rédiger, relire), l'issue
(statut, commentaire, retour en arrière, historique), l'entretien (préparer,
relire) et les documents réellement partis.

Ce qui appartient à l'offre — score détaillé, compétences, écart au CV de
référence — reste sur l'offre, à un clic en haut de page.

Les actions de suivi sont les mêmes des deux côtés : elles prennent désormais
un chemin de retour, vérifié comme relatif à l'application, et rafraîchissent
l'écran d'où vient le clic. Agir depuis le suivi ne fait plus sortir du suivi.

---

## D89 — L'indice là où se prend la décision

D78 avait corrigé ce que l'indice raconte, pas l'endroit où il se lit. Le
détail par source vivait sur l'écran Formulations — c'est-à-dire **derrière le
clic qu'il était censé éclairer**. Sur la fiche d'offre, là où l'on décide, il
ne restait qu'une ligne inchangée depuis l'étape 4ter.

Le bloc complet remonte donc à côté du bouton « Adapter les formulations » : le
verdict en une phrase — « ne lance pas d'adaptation » ou les termes du corpus
nommés un par un —, la couverture, et le reste replié derrière un détail.

La couleur est corrigée par la même occasion. Depuis D78, « fort » signifie
qu'il y a de la matière exploitable ; il s'affichait en rouge, comme une
alerte. Le bleu dit une occasion, l'ambre une occasion mince, le gris qu'il n'y
a rien à aller chercher — et que c'est très bien ainsi.

Enfin, une offre **sans CV composé** dit désormais pourquoi elle n'a pas
d'indice : il se mesure entre l'annonce et le CV réellement sélectionné, il ne
peut donc pas exister avant lui. Le silence laissait croire à une panne.

---

## D90 — Le CV composé fait foi pour « ce qui est déjà dit »

Constat du 29 septembre, sur l'offre ARC Europe France. L'indice annonçait
trois termes à aller chercher dans le corpus :

> contrôleur de gestion · comptabilité · Comptabilité générale

Le premier est le **titre imprimé en majuscules en tête du CV**. Dans le même
bloc, « business partner » était rangé en compétence alors que l'accroche dit
mot pour mot *« prêt à intervenir en véritable business partner »*.

La cause : pour décider si un terme est déjà sur le CV, le calcul ne regardait
que **les missions sélectionnées et les libellés de compétences**. Il ignorait
le titre, l'accroche et les intitulés de poste — le haut de la page. Trois
termes fantômes suffisaient à afficher « fort », et à encourager une génération
facturée 4,4 ¢ qui ne pouvait rien produire.

D78 avait corrigé *d'où* vient un terme, jamais *ce qui compte comme déjà
présent*. Le défaut datait de l'étape 4ter ; D78 l'a rendu visible en nommant
les termes, et c'est comme ça qu'il a été trouvé.

Le texte du CV composé — celui-là même qui sera imprimé — est désormais passé
au calcul. Rien de ce qui figure sur la page ne peut plus être compté comme
manquant.

`documents.selection` passe au **schéma 5**. La forme ne change pas, les valeurs
si : un indice de schéma 4 surestime ce qui reste à récupérer, et les deux
écrans le disent — « régénère le CV, c'est gratuit » — au lieu de l'afficher
comme s'il valait encore.

## D91 — Une proposition écartée reste lisible

Une **reformulation** rejetée était conservée avec son motif : visible,
relisible, acceptable à la main. Une **mission proposée** rejetée était jetée.
L'appel était payé pour une phrase que personne ne lirait jamais, et sans même
savoir lequel des six contrôles s'était déclenché.

Elle est désormais conservée comme sa cousine : la mission est créée inactive —
aucune sélection ne la voit — et la proposition s'affiche dans sa section avec
son motif, sur fond ambre. Tu peux l'accepter quand même si tu la juges juste :
c'est toi qui signes la ligne. « Refuser » la supprime pour de bon, comme avant.

Un troisième rejet muet disparaît au passage : une proposition dont aucun code
d'activité n'était exploitable était écartée sans un mot. C'est maintenant un
motif comme les autres — et depuis D74, un code manquant s'ajoute en trente
secondes.

---

## D92 — Le destinataire servait à l'en-tête, jamais à la lettre

Constat du 29 septembre : le nom du contact était saisi, enregistré, affiché
dans le bloc destinataire — et le corps de la lettre disait toujours
« Madame, Monsieur ».

La cause tient en une ligne. Le nom **n'était pas transmis au modèle**. Celui-ci
rendait donc la formule générique de l'exemple du prompt, et le code la
reprenait telle quelle *à condition qu'un contact existe* — en croyant qu'elle
avait été personnalisée. La condition était juste, l'information manquait.

Deux corrections. Le destinataire est désormais donné au modèle, avec
l'interdiction d'écrire « Madame, Monsieur » dans le corps quand une personne
est identifiée. Et la **formule d'appel est calculée**, plus demandée : une
civilité est un fait, elle n'a pas à dépendre d'une génération.

Aucune civilité n'est déduite d'un prénom — c'est faux une fois sur dix et
vexant à tous les coups. Elle se lit dans ce qui est saisi : « Monsieur Dupont »
donne « Monsieur, », l'usage français voulant que le patronyme reste dans
l'en-tête et non dans la formule. Sans civilité écrite, la lettre garde
« Madame, Monsieur, », et l'écran dit comment obtenir mieux.

## D93 — Le contrôle de style

L'ancrage vérifie que la lettre ne ment pas. Il ne dit rien de la façon dont
elle est écrite, et c'est là que la lettre déçoit — pour la moitié de la
dépense IA de l'application.

Sur une lettre réelle du 29 septembre, deux défauts dominaient.

**Aucune phrase principale n'avait de sujet humain.** « Le pilotage des
indicateurs s'est accompagné de… », « la construction des tableaux de bord a
nécessité de… », « Le parcours traverse trois secteurs », « Ce passage par
plusieurs ERP a construit une capacité à… ». Des travaux qui se font tout
seuls, une prose de note de service — et c'est cela, bien plus que le
vocabulaire, qui fait sentir la machine.

**Et le texte comptait.** « Quatre expériences », « Deux expériences
illustrent », « trois secteurs distincts » : une énumération annoncée à chaque
paragraphe. Compter structure un rapport ; une lettre se lit d'un trait.

Le prompt gagne donc une section **LA VOIX**, placée comme la règle la plus
importante : le candidat est le sujet des verbes principaux, trois paragraphes
sur quatre commencent par « j'ai », et les noms d'action en sujet sont
nommément proscrits, exemples à l'appui. S'y ajoutent l'interdiction de
compter, d'annoncer son plan, de resservir les besoins de l'annonce en liste,
d'écrire « vs », de dire deux fois la disponibilité, et de clore sur « je reste
à disposition pour échanger sur les modalités d'un entretien ».

Un prompt ne se vérifie pas tout seul : `src/lib/lettre/style.ts` relit la
lettre produite et nomme ce qu'il trouve, sans appel IA. Le résultat s'affiche
au-dessus du texte, à côté du contrôle d'ancrage, et **ne bloque rien** : une
lettre se corrige à la main, dans le champ modifiable, sans repayer une
génération.

Neuf tests figent ces cas, tirés mot pour mot de la lettre fautive — et un
dixième vérifie qu'une lettre correctement écrite ne déclenche rien. Un
contrôle qui crie sur tout ne sert à rien.

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
