# Neuf constats d'usage — décisions D78 à D95

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

## D94 — L'adresse de candidature était dans l'annonce, et on la jetait

Certaines offres ne passent pas par un formulaire : « Comment postuler ? Un
simple mail avec un CV à Jonathan THIRIONET, Responsable Recrutement :
j.thirionet@… ». Cette phrase était dans `contenu_brut` depuis le premier jour,
lue et payée avec le reste. Il fallait rouvrir l'annonce pour la retrouver.

La question posée — « sans payer ? » — a changé la conception. Une adresse mail
est un **motif**, pas une question de langue : l'expression régulière la trouve
gratuitement, **rétroactivement sur toutes les offres déjà analysées**, et,
contrairement à un modèle, elle ne peut pas en inventer une. Le champ a donc
été retiré de l'extraction IA avant même d'y être ajouté.

Le tri fait tout le travail. Sur les sept adresses présentes dans la base au
29 septembre, **deux seulement** servaient à candidater :

| Trouvé | Verdict |
|---|---|
| `j.thirionet@auditionconseil.com` | retenu — « Un simple mail avec un CV à Jonathan THIRIONET » |
| `direction@boulangeriemillet.com` | retenu — « Envoyez-nous votre CV […] à l'adresse suivante » |
| `dpo@septeo.com` (trois offres) | écarté — mention RGPD |
| `diversite.fr@siemens.com` | écarté — référent Mission Handicap |
| `exemple@exemple.fr` | écarté — placeholder d'un formulaire de connexion |

Sont exclus d'office : les `noreply`, les `dpo@`/`rgpd@`, les `exemple@`, les
domaines des plateformes, et toute adresse dont la phrase parle de RGPD, de
handicap ou d'espace candidat. Sont classées en tête celles dont la phrase
parle de candidature, de CV ou d'envoi, et celles dont la partie locale
ressemble à un patronyme.

Le **nom n'est pas deviné** : il n'est retenu que sur la forme « à Prénom NOM »,
et c'est la **phrase de l'annonce** qui est affichée en dessous. Ses mots, donc
faux zéro fois.

## D95 — Tout ce qu'il faut pour coller, au même endroit

L'application n'envoie rien et ne prétend pas le faire. Elle met les morceaux à
portée de deux clics.

Sur la **fiche d'offre**, bloc « Lettre et email » : l'adresse, le nom quand il
est sûr, et la phrase source. On sait avant même de rédiger que cette offre-là
part par mail.

Sur l'écran **Lettre**, sous l'email : l'adresse en clair et trois boutons de
copie — l'adresse, l'objet, le corps. Plus **« Adresser la lettre à … »**, qui
reprend le nom extrait dans le champ destinataire et referme ce que D92 a
corrigé : la formule d'appel devient nominative.

L'envoi automatique depuis l'application a été écarté après examen : OAuth
Google, jetons en base, et surtout des jetons de rafraîchissement qui expirent
au bout de sept jours tant que l'application reste en mode test — une corvée
hebdomadaire pour économiser un clic sur « Envoyer ».

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

---

# Sixième passe — 1er octobre

Six remarques après une nouvelle session d'usage réel. Quatre corrections de
code, une reconstruction complète du prompt de lettre, et un travail de
dépouillement de boîte mail.

## D96 — La lettre, refondue sur des sources et non sur mon intuition

> « Pour la lettre j'ai toujours pas ce qu'il faut, en la lisant je sens que
> c'est de l'IA. Essaye de chercher un mode ou des consignes de création de
> lettres de motivation sur Google ou sur internet et on l'applique ensuite
> pour la génération, parce que c'est complètement non adapté et ça me coûte
> cher. »

La demande était la bonne, et la critique implicite juste : jusqu'ici le prompt
de lettre disait ce que **je** trouvais bien écrit. Trois refontes successives
(D80, D92, D93) ont ajouté des interdits un par un, chacun tiré d'une lettre
ratée — mais aucune n'est partie de ce que disent ceux qui lisent ces lettres
pour de vrai. D'où un prompt cohérent avec lui-même et sourd au métier.

### Les sources retenues

- **France Travail** nomme la « signature ChatGPT » et en cite les formules mot
  pour mot : « Actuellement en recherche active, je souhaite mettre mes
  compétences en … au service de votre entreprise », « Je suis convaincu que
  mon dynamisme et ma rigueur … », « Fort de mon expérience … ».
- **Welcome to the Jungle** a fait juger des lettres IA par des recruteuses.
  Verdict à retenir tel quel, parce qu'il est double : elles sont « toutes bien
  rédigées et bien structurées » — mieux que la moyenne des lettres reçues —
  mais « les lettres de l'IA manquent de personnalité ». Le problème n'est donc
  pas la qualité d'écriture. C'est l'absence de singularité.
- **L'Office québécois de la langue française**, sur la lettre
  d'accompagnement : « Énumérer les réalisations (cela relève du CV) » et ne pas
  « rédiger comme une circulaire avec phrases toutes faites ».
- **Le repérage d'une lettre générée** tient aussi au rythme : « absence de
  variations rythmiques naturelles », « adverbes et modalisateurs
  disproportionnés », « ton uniformément élogieux, peu crédible ».
- **EURES** et l'OQLF s'accordent sur la forme : trois ou quatre paragraphes,
  une seule page, et s'adresser à une personne nommée quand on la connaît.

### Ce que les sources ont contredit dans mon prompt

L'OQLF donne la réponse exacte à la question posée le 29 septembre — « c'est
quoi ce style d'énumération : quatre missions, deux expériences, trois
secteurs, à quoi sert ? ». Énumérer relève du CV. Or le prompt **poussait** à
l'énumération : son paragraphe 2 était décrit comme « le cœur, le paragraphe le
plus dense et le plus long », avec un budget de 700 signes et la consigne
d'« au moins deux faits précis ». Un modèle à qui l'on demande de la densité
sur deux faits en empile quatre. Le défaut venait de l'instruction, pas du
modèle.

Deuxième contradiction : le plan. Les quatre paragraphes étaient *tous* sur le
candidat — qui il est, ce qu'il apporte, ce qui le distingue, sa disponibilité.
L'entreprise n'apparaissait nulle part, et une instruction explicite interdisait
même d'ouvrir sur elle. C'est l'inverse du plan attendu en France.

### Le nouveau plan — vous / moi / nous

**Trois paragraphes**, 1 800 signes au total, une page.

1. **Vous** (450 signes) — le poste nommé, et **un fait concret pris dans
   l'annonce** : un problème que ce recrutement doit résoudre, un contexte
   (création de poste, réorganisation, multi-sites), une mission qui structure
   le reste. Une citation de fait, jamais un compliment. Si l'annonce ne dit
   rien d'autre que des tâches, le paragraphe est court — mieux vaut bref
   qu'inventé.
2. **Moi** (800 signes) — **une seule situation vécue, racontée en entier** :
   ce qui n'allait pas, ce qui a été fait, ce que ça a donné. Deux faits sont un
   maximum absolu, et le second n'est admis que s'il découle du premier. Plus de
   trois groupes séparés par des virgules dans une phrase est interdit. Le
   critère de réussite est formulé pour être vérifiable à la relecture : le
   lecteur doit pouvoir se représenter une scène.
3. **Nous** (450 signes) — ce que le candidat ferait dans les premiers mois,
   la disponibilité, la demande d'entretien.

S'y ajoutent deux règles de forme, tirées des sources : au moins une phrase de
moins de dix mots par paragraphe, et deux adverbes d'intensité au maximum dans
toute la lettre.

## D97 — Un métier du barème n'est pas une adaptation

> « Un exemple d'une offre : ça m'affiche adaptation : comptabilité générale
> alors que c'est complètement un métier ou un module. Mais quand j'ai lancé
> l'adaptation elle m'a affiché 0 proposition, avec le message d'adapter. »

Le diagnostic tient en une phrase : **« comptabilité générale » n'est pas une
tâche qu'on ajoute à une ligne de CV, c'est un métier entier — et un code du
barème.** Plusieurs missions portent déjà `compta_generale` ; le score le mesure
donc, par les codes. Aucune reformulation ne peut « insérer » un métier dans une
phrase, et c'est pourquoi la génération rendait zéro proposition tout en
affichant un potentiel.

D78 avait construit exactement la machinerie qu'il fallait : les termes
récupérables sont ventilés par **source**, et chaque source porte le texte de ce
qu'elle autorise réellement. Il manquait une cinquième source, qui n'est pas une
source du parcours mais une nature de terme.

`SourcePotentiel` gagne donc `"activite"`. Un terme de l'annonce qui est le
libellé d'un code de la taxonomie :

- sort **avant** tout examen des sources — quelle que soit sa provenance, il n'y
  a aucun geste d'adaptation qui l'ajoute ;
- n'entre ni dans `recuperables` (rien à récupérer) ni dans `horsPortee`, qui
  dirait à tort qu'il manque au profil ;
- ne compte pas dans le niveau, qui ne regarde que le corpus.

Il s'affiche avec son propre message : *« C'est un métier du barème, pas une
tâche : le score le mesure déjà par les codes de tes missions. Si le mot doit
apparaître, sa place est le titre du CV ou l'accroche du volet. »* La dernière
phrase est la seule action utile, et elle est gratuite.

La liste des métiers est **toute** la taxonomie, codes inactifs compris : un
code retiré du service reste un métier, et le proposer en reformulation serait
aussi absurde qu'avant son retrait.

## D98 — L'indice d'adaptation dès l'analyse

> « Est-ce que pour le message d'adapter ou pas ça peut s'afficher dès
> l'analyse de l'offre, pas suite à la génération du premier CV ? »

L'indice attendait la composition du document pour une raison qui n'en est pas
une : c'est là qu'on avait la sélection sous la main. Rien ne l'y obligeait.

`estimerPotentiel` refait le premier essai de la génération — `choisirNiveau`,
qui estime la hauteur par comptage de caractères et **ne compose aucun PDF**.
Même sélection, même texte, donc le même indice, pas l'approximation d'un autre
algorithme. Coût : zéro appel IA, zéro rendu.

Une seule réserve, dite à l'écran : si le CV composé déborde d'une page, la
génération descendra d'un cran et retirera des missions, donc l'indice réel sera
un peu **plus haut** que l'estimation. Se tromper dans ce sens est le bon sens :
l'indice sert à décider s'il faut *payer*, et une estimation prudente ne pousse
jamais à la dépense.

L'écran « aucun indice » ne dit plus « génère le CV ». Il dit d'analyser
l'offre — ou, si l'analyse existe et qu'aucune expérience n'est visible dans le
volet, que le problème est une visibilité à corriger dans Mon profil.

## D99 — Un filtre sur le suivi des candidatures

> « J'aimerais aussi un filtre comme celui du volet offres dans le volet
> candidatures. »

Même mécanique que sur Offres, et pour la même raison : les filtres vivent dans
l'URL, donc la page reste rendue côté serveur, le retour arrière fonctionne et
un filtre choisi tient dans un signet.

Les états ne sont pas ceux d'Offres, parce que la question n'est pas la même.
Ici tout est déjà parti : **Toutes**, **À relancer**, **Sans réponse**,
**Entretien**, **Closes**. Quatre tris : par urgence (défaut, l'ordre de D81),
plus récentes, plus anciennes, meilleur score.

S'y ajoute une ligne que le dépouillement de la boîte mail rend enfin utile :
un **filtre par provenance**, construit depuis les données et non depuis la
liste fermée — proposer « Monster (0) » n'aiderait personne. Les candidatures
sans origine connue ont leur propre puce : c'est aussi une information, et elle
en dit long sur ce que les 33 restantes ont en commun. La ligne n'apparaît qu'à
partir de deux origines distinctes ; avec une seule elle ne filtrerait rien.

## Un piège coûteux, corrigé au passage

`normaliser` remplace **toute** ponctuation par une espace : « c'est » devient
« c est », « l'annonce » devient « l annonce ». Trois motifs du contrôle de
style écrivaient l'apostrophe comme `['’]` et ne pouvaient donc correspondre à
rien. Ils passaient les tests parce qu'une autre alternative de la même
expression régulière attrapait le cas — la règle était morte, son test vert.

Corrigé, et la règle est désormais écrite en tête du fichier : dans un motif qui
s'applique à du texte normalisé, une apostrophe s'écrit `\s`.

## Le dépouillement de la boîte mail

> « Pour les offres que j'ai déjà envoyées et que j'ai pas mis de source, tu
> peux voir dans ma boîte si tu trouves un site de recrutement, et revérifier
> les refus aussi. »

**Cinq refus** écrits en base, chacun avec la phrase de l'expéditeur et sa date
dans `statuts_historique` : MEOGROUP (30/09), Mary (29/09) et Entreprise
Beaudeux et Fils (30/09) via HelloWork ; **ADEF RESIDENCES** (29/09, Taleez) et
**Nové Gestion** (21/09, UES Aiguillon), trouvés à la deuxième passe avec une
recherche par formules de refus plutôt que par expéditeur.

**Trente-six origines** sur soixante-dix, à partir de quatre motifs sûrs :
`contact@emails.hellowork.com` (« Votre candidature est arrivée chez X »),
`jobs-noreply@linkedin.com` (« Votre candidature a été envoyée à X »),
`no-reply@apec.fr` (« Candidature sur offre d'emploi N° … - ENTREPRISE - poste »)
et `indeedapply@indeed.com`.

**Trente-trois restent vides, et c'est un arrêt volontaire.** Aucune trace dans
la boîte : ces candidatures sont parties directement sur le site de l'entreprise
ou son ATS — Taleez, DigitalRecruiters, SmartRecruiters, werecruit, flatchr,
profils.org, broadbean. L'accusé de réception vient alors du recruteur, jamais
d'une plateforme, et rien ne permet de remonter à la source. Deviner serait pire
que laisser vide : la colonne sert à mesurer le rendement par canal, et une
valeur inventée fausserait la seule chose qu'elle mesure.

Deux refus trouvés dans la boîte ne correspondent à aucune offre en base —
Cluxelite (23/09) et Transports PORTMANN (18/09). Vérifié par recherche dans
`contenu_brut` avant de conclure, plutôt que par ressemblance d'intitulé.

## Indeed — lecture seule

> « Je pense t'as aussi accès à mon compte Indeed, donc essaye d'alimenter tout
> ce qui manque dans les infos de la plateforme. »

Le connecteur expose quatre opérations — lire le CV, chercher des offres, lire
une offre, lire une entreprise — et **aucune écriture**. Je ne peux pas mettre le
profil à jour.

Ce que la lecture apprend, en revanche, valait le détour : le profil Indeed est
très en retard sur la base. Trois expériences sur cinq, la plus récente affichée
étant un stage de 2023 — **le CDD de contrôleur de gestion 2026 et l'alternance
2024-2025 sont absents**. Un recruteur qui ouvre ce profil voit un stagiaire
comptable, et ce profil travaille sans lui, tout le temps. Quatre des six
compétences listées sont des adjectifs.

Le contenu exact à coller est dans `docs/PROFIL_INDEED.md`, poste par poste,
prêt à recopier sur profile.indeed.com.

---

# Septième passe — 1er octobre, après-midi

Une seule lettre, générée sur l'offre **in'li** (contrôleur de gestion
opérationnel, groupe de 80 000 logements, Île-de-France), et le verdict est
sans appel : la refonte de D96 a tenu sur la **forme** et raté le **fond**.

Trois paragraphes, une seule situation racontée, aucune énumération, aucune
signature ChatGPT, 1 500 signes. Tous les contrôles de D96 au vert. Et la
lettre est mauvaise.

## D100 — Le CV était transmis à la lettre comme une liste noire

La lettre a raconté **un stage de 2023 dans une usine de lingerie à Fès**, pour
candidater chez un bailleur social d'Île-de-France.

Le moteur de sélection, lui, avait eu raison. Le CV composé pour cette offre
classe **Le Mans Métropole Habitat en première et deuxième position** :
quittancement d'un patrimoine de 18 000 logements, charges récupérables
prévisionnelles et quittancées, indicateurs de gestion locative par agence.
TECHNICAPS troisième. TRIUMPH **dernier**.

La cause n'était pas dans le modèle. Elle était dans le message, et c'est une
instruction que j'avais écrite :

```
DÉJÀ SUR LE CV, À NE PAS REDIRE MOT POUR MOT :
  • Contrôlé mensuellement le quittancement d'un patrimoine de 18000 logements…
  • Analysé les écarts entre charges récupérables prévisionnelles et quittancées…
```

**La sélection la plus pertinente — celle que tout le moteur travaille à
produire — arrivait au rédacteur sous forme d'interdit.** Il l'a évitée,
consciencieusement, et il est allé chercher la seule expérience restante qui
portait un chiffre frappant : 5 à 10 points de marge, dans une usine.

Le message nomme désormais l'expérience au lieu de l'interdire. Trois
changements :

1. **`EXPÉRIENCE À RACONTER AU PARAGRAPHE 2 — CE N'EST PAS UN CHOIX`**, calculée
   par `choisirNiveau` — gratuit, aucun PDF composé — donc juste même quand
   aucun CV n'a encore été généré.
2. **Le corpus de cette expérience-là est joint**, et d'elle seule. Les puces du
   CV sont des résultats sans contexte ; une situation se raconte avec ce qu'il
   y avait autour, et c'est dans le corpus que ça se trouve. Aucune de ces
   lignes n'est sur le CV, donc la lettre ne le répète pas — l'objectif initial
   de l'interdit est atteint sans l'interdit.
3. Le reste du CV garde son rôle de « ne pas recopier mot pour mot », mais
   **après** l'expérience nommée, et plus à sa place.

Une porte de sortie est laissée : si l'expérience imposée ne répond vraiment à
rien dans l'annonce, le modèle prend la suivante et doit le dire en une phrase.

## D101 — Ma règle de rythme a produit trois proverbes

D96 exigeait « au moins une phrase de moins de dix mots par paragraphe ». La
contrainte a été respectée, et remplie avec du vide :

> « Un périmètre large exige des indicateurs fiables. »
> « Un chiffre juste change une décision. »
> « Je resterais attentif aux signaux faibles. »

**Une contrainte de forme sans contrainte de contenu se remplit toujours par le
chemin le plus court.** Le prompt demande désormais qu'une phrase brève porte un
fait — un chiffre, un outil, un employeur — et donne ces trois phrases en
contre-exemples, avec le test : si elle reste vraie en la déplaçant dans
n'importe quelle autre lettre, elle saute. Mieux vaut un paragraphe sans phrase
courte qu'un paragraphe avec une maxime.

Le contrôle correspondant a demandé deux essais. La première version attrapait
aussi « Disponible immédiatement, je souhaite échanger sur ces missions lors
d'un entretien » — une clôture irréprochable. Le discriminant trouvé est la
première personne : **une maxime est une vérité générale, elle ne parle de
personne.** Précision plutôt que couverture, délibérément : un panneau qui se
trompe deux fois sur cinq cesse d'être lu.

## D102 — Le conditionnel en rafale, et l'annonce citée comme source

Le paragraphe 3 entier : « je consoliderais les indicateurs, j'objectiverais les
écarts, je resterais attentif ». Trois hypothèses à la suite ne décrivent rien.
Un seul conditionnel est désormais autorisé ; le reste s'écrit au présent.

Et : « en lien avec les projets data **évoqués dans l'annonce** ». Le recruteur a
écrit cette annonce — la lui citer comme source est une maladresse. Le motif
« Recopie de l'annonce » de D93 ne couvrait que la liste resservie ; un second
motif vise la citation comme document.

## D103 — Un faux positif silencieux, vieux de D93

> « Les pistes de marge identifiées ont nourri les recommandations transmises au
> management opérationnel. »

C'est exactement le défaut que D93 avait été écrit pour attraper : le travail
s'y fait tout seul. Il est passé pour **deux caractères manquants**.

Le motif de première personne s'écrivait `\b(je|j['’]|mon|ma|mes|m['’])` —
**sans limite de mot finale**. « ma » y correspondait donc au début de
« management », de « marge », de « maintenant », de « mesure », de « montant ».
La phrase était tenue pour écrite à la première personne, et le contrôle la
sautait.

Un faux positif de ce genre est silencieux : il ne produit pas d'erreur, il
**éteint une règle**, et son test reste vert. Corrigé, avec la limite finale.

S'y ajoute une mesure qui ne dépend d'aucun vocabulaire, parce que
`NOMS_ABSTRAITS` est une liste fermée et ne le sera jamais : **la part de
phrases sans première personne**. Au-delà d'une sur trois, dans une lettre
écrite à la première personne, c'est une prose qui parle du travail au lieu de
parler du candidat. Sur la lettre in'li : quatre sur dix.

## Ce que les cinq contrôles disent maintenant de cette lettre

```
• Phrase sans sujet humain (1)   « Les pistes de marge identifiées… ont nourri »
• Maxime (2)                     « Un périmètre large exige des indicateurs fiables. »
• Conditionnel en rafale (3)     consoliderais, objectiverais, resterais
• Renvoi à l'annonce             « évoqués dans l'annonce »
• Phrases sans « je » (4 sur 10) « Vous ouvrez ce poste de Contrôleur de Gestion… »
```

Aucun faux positif sur la lettre de référence saine. **118 tests.**

---

# 4 octobre — le CV compta : la place vide et la compétence invisible

Deux constats sur un même PDF, un CV comptable généré pour un cabinet
d'expertise comptable indépendant. Ils n'ont rien en commun sauf d'être
invisibles depuis l'écran.

## D119 — Pennylane n'était pas une affaire de niveau

L'offre réclame Pennylane trois fois : dans ses outils, dans ses compétences
souhaitées, dans ses mots-clés ATS. Le profil la porte, en notions. Le CV ne
l'écrivait pas.

La première hypothèse — le plancher `niveau >= 2` — était fausse : ce seuil ne
s'applique qu'au bonus « cœur de métier », jamais aux outils. La cause était en
base :

| libellé | niveau | visible_cdg | visible_compta |
|---|---|---|---|
| Pennylane | 1 | **true** | **false** |

À l'acceptation d'une compétence révélée par une offre, le code écrivait
`visible_cdg: maitrisee && volet === "cdg"`. La compétence n'entrait donc que
dans le volet de l'offre qui l'avait révélée. Pennylane avait été acceptée
depuis une offre de contrôle de gestion : elle n'avait plus aucun chemin vers
un CV comptable, le seul où un cabinet la demanderait.

Ce n'était pas un cas isolé. **Cent quarante-huit compétences** étaient dans
cet état : dix-neuf outils (SAP, Sage X3, CEGID, Google Sheets…),
trente-six lignes cdg, soixante-dix-sept transversales — plus les huit lignes
du profil d'origine, séparées par volet dès la saisie initiale.

Et le trou était muet. `detailCouverture` lit la table **sans filtre de
visibilité** : l'écran annonçait la compétence couverte, ne la reproposait pas,
et le PDF ne l'écrivait pas. Le barème la comptait aussi. Deux vues disaient
que Taha l'avait, la troisième l'omettait.

**Décision.** Le profil ne se découpe pas par volet. Taha sait ce qu'il sait ;
le volet décide seulement de ce qui mérite d'être montré face à une offre
donnée, et c'est la note de sélection qui en juge, offre par offre. Une
compétence hors sujet y marque zéro et ne sort pas — elle n'a pas besoin d'être
masquée pour cela.

À l'acceptation comme au rétablissement, une compétence maîtrisée devient donc
visible dans les deux volets. Reprise unique en base (`0016`) sur les cent
quarante-huit lignes concernées. Restent invisibles, et c'est voulu : les
soixante-deux compétences au niveau zéro (non maîtrisées, gardées pour ne plus
être reproposées) et les treize masquées délibérément depuis Mon profil
(« Orientation business », « ERP », « Capacité à gérer plusieurs sujets
simultanément »… des catégories, pas des compétences).

Vérifié sur l'offre du cabinet : la ligne d'outils devient `Sage 100,
Pennylane, Excel, ULIS Sopra, Microsoft Office, SILOG`. Pennylane en deuxième
position, note 4 — souhaitée par l'offre.

## D120 — trente-sept points de blanc, parce que l'échelle est trop grossière

Le même CV est sorti au cran 4 : 3/3/2/2 missions, huit compétences. Avec du
blanc en bas de page. Mesuré :

```
hauteur disponible      775,9 pt
CV tel que généré       738,2 pt   → 37,7 pt libres ≈ 3 puces
```

Le cran au-dessus (3/3/3/3 **et** neuf compétences) ajoute trois puces *et* une
compétence, environ quarante-huit points : il ne passe pas. `choisirNiveau`
redescendait donc, et les 37,7 pt restaient vides. S'y ajoute que la fonction
**descend, et ne remonte jamais** : rien ne récupérait cet espace même quand la
composition réelle tenait largement.

L'estimation n'était pas trop pessimiste. L'**échelle** était trop grossière :
chaque cran déplace quatre choses à la fois. Inventer des crans intermédiaires
en demanderait un par combinaison.

**Décision.** On part du cran qui tient et on rend les places **une par une**.
D'abord amener toutes les expériences à trois missions, puis seulement passer
les premières à quatre — une expérience à deux puces paraît maigre où qu'elle
soit, une quatrième puce sur la première n'est qu'un bonus. Plafond : quatre
missions par expérience, six ajouts par CV.

La passe existe deux fois, et ce n'est pas un doublon. Dans le **générateur**,
c'est la composition réelle qui arbitre : elle fait foi sur le PDF livré. Dans
`choisirNiveau`, c'est l'estimation — sans quoi la reformulation et l'écran
d'offre annonceraient trois missions de moins que le CV n'en portera, et
proposeraient de retravailler des lignes qui paraissent pendant qu'elles
tairaient celles qui paraissent. L'estimation étant la plus prudente des deux,
l'écart joue dans le bon sens : ce qui est annoncé paraît toujours.

Deux détails qui auraient fait des bugs silencieux :

- la référence de l'écart reçoit les mêmes suppléments. Sinon trois missions
  ajoutées pour une raison de mise en page seraient comptées « mises en avant
  grâce à l'offre » ;
- le tableau des suppléments est **copié** à chaque appel. `Selection` le
  conserve ; le muter au tour suivant ferait mentir la trace stockée.

Sur le CV du cabinet, à l'estimation seule — donc au pire : **3/3/3/3/3**, les
trois puces récupérées. Le PDF composé a davantage de marge encore.

**155 tests.**
