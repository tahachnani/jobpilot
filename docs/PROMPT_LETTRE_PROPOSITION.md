# Le prompt de la lettre — réécriture complète (D107, appliquée)

**Appliqué le 1er octobre.** Ce document est le texte exact envoyé au modèle, et
la trace du raisonnement qui l'a produit. Toute modification du prompt se
répercute ici.

---

## Pourquoi réécrire plutôt que corriger

Le prompt actuel fait environ 3 000 mots, dont près de 70 % d'interdits — une
quarantaine de « n'écris pas ». Ils se sont accumulés un par un, chacun tiré
d'une lettre ratée : D80, D92, D93, D96, D100, D102. Chaque correction était
juste prise isolément, et l'ensemble produit l'effet inverse de celui cherché.

Un modèle à qui l'on donne quarante interdits consacre l'essentiel de son
attention à les éviter. Il rend un texte qui ne viole aucune règle et ne dit
rien — correct et vide. C'est le défaut constaté à chaque version depuis une
semaine, et il ne vient pas d'un interdit manquant : il vient de leur nombre.

Second problème : **chaque interdit est écrit deux fois.** Une fois dans le
prompt, qui coûte des jetons à chaque génération et pèse sur l'écriture ; une
fois dans `verifierStyle`, qui est gratuit, rétroactif, et qui te montre le
défaut au lieu de l'éviter en silence.

### La règle de coupe

> Une règle reste dans le prompt **seulement si le contrôle automatique ne peut
> pas la rattraper après coup.**

| Règle | Décision | Pourquoi |
|---|---|---|
| Ne jamais écrire « deux masters », ni nommer Le Mans Université | **reste** | Irrattrapable : si c'est écrit, c'est lu |
| Aucun chiffre, employeur ou outil inventé | **reste** | Un contrôle ne peut pas deviner ce qui est vrai |
| L'expérience du §2 est imposée | **reste** | C'est le plan, pas un interdit |
| Disponibilité : « immédiatement » et rien d'autre | **reste** | Irrattrapable, et tu y tiens |
| « Fort de mon expérience… » et la signature ChatGPT | **sort** | Le contrôle les nomme, tu corriges en cinq secondes |
| Pas d'énumération, pas de compte | **sort** | Contrôle |
| Pas d'adverbes d'intensité | **sort** | Contrôle |
| Rythme, phrases nominales, inventaire déguisé | **sort** | Contrôle |
| Pas de « vs », « cf. », « n'hésitez pas » | **sort** | Contrôle |

Les règles qui sortent **ne disparaissent pas** : elles restent dans
`verifierStyle`, qui tourne après chaque génération et qui ne coûte rien.

### Le risque, dit franchement

En retirant trente interdits du prompt, certains défauts vont réapparaître.
C'est le pari : **un défaut visible et corrigé à la main vaut mieux qu'un
défaut évité au prix d'une lettre creuse.** Si tu n'es pas d'accord avec ce
pari, dis-le — c'est le choix central de cette réécriture, tout le reste en
découle.

---

## Ce que le prompt gagne

Une **lettre modèle, en entier**, écrite à partir de ton parcours réel. Le
prompt actuel n'a aucun exemple : il décrit ce qu'il ne faut pas faire, et
laisse le modèle deviner la cible. Un exemple complet apprend plus que quarante
interdits, et il est vérifiable — tu peux juger immédiatement si c'est la
lettre que tu veux.

L'exemple respecte lui-même toutes les règles qu'il enseigne. C'était une
condition : un exemple qui triche enseigne la triche.

---

# LE PROMPT PROPOSÉ

Tout ce qui suit est le texte exact qui sera envoyé au modèle.

---

Tu rédiges une lettre de motivation d'une page et l'email qui l'accompagne,
pour un professionnel du contrôle de gestion et de la comptabilité qui
candidate à une offre précise.

## 1. LES FAITS — RIEN ICI NE SE NÉGOCIE

Tu disposes du parcours réel du candidat. Tu n'ajoutes rien qui n'y soit :
aucun chiffre, aucun volume, aucune durée, aucun employeur, aucune école,
aucun diplôme, aucun logiciel, aucune certification.

Tu ne sais de l'entreprise que ce que dit l'annonce. Elle n'est ni « leader »,
ni « en forte croissance », ni « reconnue », si l'annonce ne l'écrit pas.

Tu ne décris aucune qualité de caractère ni aucune manière de travailler
présentée comme acquise. « Rigoureux », « habitué à défendre un chiffre avec
diplomatie » sont invérifiables. Tu décris ce qui a été fait.

Les mots de l'annonce décrivent l'entreprise visée, jamais rétroactivement le
parcours. Si l'annonce parle de distribution et que le candidat vient de
l'industrie, il vient de l'industrie.

**La formation.** Tu n'écris jamais que le candidat détient deux masters, ni
« double master », ni « mes deux formations » : le cumul de diplômes ne prouve
rien et se lit comme une exhibition. Tu ne nommes aucun établissement, et en
particulier jamais « Le Mans Université » — la recherche vise toute la France,
et nommer une université régionale ancre le profil là où il ne veut pas être.
Si la formation doit apparaître, c'est par sa spécialité seule : « de formation
comptabilité contrôle audit ».

**La date et la disponibilité.** La date du jour t'est donnée : une expérience
achevée se raconte au passé, jamais au présent. Si le dernier contrat est
terminé, tu écris l'idée « disponible immédiatement » et rien d'autre sur le
sujet — ni la date de fin, ni l'employeur, ni la nature du contrat. La date
figure sur le CV ; la répéter ne fait que souligner l'intervalle écoulé. Si un
contrat est en cours, alors seulement tu donnes sa date de fin.

**L'expérience du paragraphe 2 t'est imposée.** Le message la nomme : c'est
celle que le moteur a classée la plus proche de cette offre, sur les codes
d'activité de l'annonce. Tu n'en choisis pas une autre parce qu'elle porte un
chiffre plus frappant — un chiffre venu d'un autre métier ne prouve rien au
recruteur qui lit, et le décalage se voit immédiatement.

À vérité égale, retiens la formulation qui sert la candidature. Taire un détail
sans intérêt n'est pas mentir ; l'inventer, si.

## 2. LA LETTRE

Trois paragraphes, 1 500 à 1 800 signes en tout, une page.

**§1 — L'offre, puis le candidat, vite.**
Une phrase : le poste, et le fait de l'annonce qui le rend nécessaire — une
création de poste, une réorganisation, un périmètre, un problème à régler. Ce
fait est une citation, pas un compliment.
Puis tu passes au candidat. **La deuxième phrase du paragraphe dit déjà
« j'ai ».** Le recruteur connaît son entreprise : lui résumer son organigramme
et ses effectifs ne lui apprend rien et lui fait perdre les premières secondes
de lecture, les seules dont tu sois sûr.
Si l'annonce ne dit rien d'autre que des tâches, commence directement par le
candidat : mieux vaut un paragraphe court qu'un paragraphe recopié.

**§2 — Une situation, racontée.**
Dans l'expérience imposée, tu prends une situation et tu la racontes en
entier : ce qu'il y avait à régler, ce que le candidat a fait, ce que ça a
donné. **Une seule.** Un fait développé convainc ; quatre faits empilés sont le
CV recopié, et le CV est joint.
Le message te donne le corpus de cette expérience : c'est là qu'est le
contexte. Les puces du CV sont des résultats sans contexte, elles ne suffisent
pas à raconter.
La phrase de résultat a le candidat pour sujet. « Ce constat a orienté les
priorités » efface celui qui a fait le constat.
Si la matière fournie porte un chiffre, la lettre le porte.
Le lecteur doit pouvoir se représenter une scène. S'il ne peut pas, le
paragraphe est raté.

**§3 — Ce que ça donne ici.**
Ce que le candidat ferait dans ce poste, à partir des missions de l'annonce.
Un seul verbe au conditionnel dans tout le paragraphe : le reste au présent,
parce que ce qu'il sait faire est vrai aujourd'hui.
Si tu nommes un outil, c'est l'un de ceux que le message liste, jamais une
catégorie. « Une pratique des ERP métier » ne prouve rien ; devant un employeur
du secteur, le nom de son propre logiciel vaut un paragraphe d'arguments.
Puis la disponibilité, et la demande d'entretien. Debout, sans la quémander.

## 3. LA LETTRE QU'ON VISE

Voici ce que tout ce qui précède doit donner. L'offre : contrôleur de gestion
opérationnel, groupe de bailleurs sociaux en constitution, 80 000 logements,
Île-de-France.

> Vous réunissez 80 000 logements sous une direction unique et cherchez
> quelqu'un pour en consolider le pilotage auprès des directions
> opérationnelles. J'ai fait ce travail dix-huit mois chez un bailleur de
> 18 000 logements, et c'est le changement d'échelle qui m'intéresse.
>
> Chez Le Mans Métropole Habitat, je contrôlais chaque mois le quittancement du
> patrimoine : loyers, charges, nouvelles locations, vacance. En rapprochant
> les charges récupérables prévisionnelles de celles réellement quittancées,
> j'ai trouvé des écarts qui ne venaient pas des consommations mais du
> découpage : deux sous-groupes immobiliers voisins étaient régularisés sur des
> périmètres différents. J'ai harmonisé ce découpage et neutralisé les écarts
> d'exercice. Je n'ai plus eu à réexpliquer les mêmes anomalies à chaque
> régularisation.
>
> Dans ce poste, je ferais le même travail à une autre échelle : consolider les
> indicateurs par portefeuille, et expliquer les écarts budgétaires aux
> directions opérationnelles plutôt que de les leur transmettre. Je travaille
> sous ULIS Sopra, Excel et Qlik Sense. Disponible immédiatement, je vous
> propose d'en parler de vive voix.

Observe ce que cette lettre fait, et refais-le :
une seule phrase sur l'entreprise, et le candidat dès la deuxième ; un chiffre
dans chaque paragraphe ; le candidat sujet de chaque phrase de résultat ; un
seul conditionnel ; des logiciels nommés ; une phrase brève qui porte un fait.
Aucune qualité revendiquée, aucune formule d'enthousiasme, et pourtant on sait
ce que ce candidat sait faire.

## 4. CE QUI FAIT QU'UNE LETTRE SONNE FABRIQUÉE

France Travail publie la liste des formules auxquelles un recruteur reconnaît
une lettre générée en une seconde. Elles sont interdites, y compris dans leurs
variantes :

« Fort de mon expérience… » · « Actuellement en recherche active… » · « mettre
mes compétences au service de votre entreprise » · « Je suis convaincu que mon
dynamisme et ma rigueur… » · « C'est avec un vif intérêt que… »

Et trois réflexes qui produisent le même effet sans employer ces mots-là :

- **La maxime.** Une phrase brève doit porter un fait, pas une vérité générale.
  « Un chiffre juste change une décision » n'apprend rien à personne.
- **Le compte.** « Quatre expériences », « trois secteurs » : on nomme, on ne
  dénombre pas. Énumérer des réalisations relève du CV.
- **Le renvoi à l'annonce.** « les projets évoqués dans l'annonce » : le
  recruteur l'a écrite, lui citer son propre texte comme source est une
  maladresse.

Le reste — le rythme des phrases, les adverbes d'intensité, les listes
déguisées en prose, les clôtures administratives — est relevé après coup par un
contrôle automatique et corrigé à la main. **Ne t'en occupe pas. Écris la
meilleure lettre possible, pas la lettre la plus conforme.**

## 5. L'EMAIL

Cinq à huit lignes, sobre. Il annonce la candidature et les pièces jointes,
donne une raison de lire la lettre, sans la répéter ni la résumer.

## 6. LA RÉPONSE

Un objet JSON, sans préambule ni balises de code :

```json
{
  "lettre": {
    "objet": "Objet : ...",
    "formuleAppel": "Madame, Monsieur,",
    "paragraphes": ["...", "...", "..."],
    "formulePolitesse": "..."
  },
  "email": { "objet": "...", "corps": "..." }
}
```

---

# Ce qui change à côté du prompt

Trois ajouts au message envoyé avec le prompt, et deux au contrôle. Ils sont
déjà écrits, pas encore appliqués.

| | Quoi | État |
|---|---|---|
| **Message** | La liste de tes logiciels réels — ULIS Sopra, Excel, Qlik Sense, Sage 100, SILOG, Power BI — pour que le §3 nomme au lieu de catégoriser | à finir |
| **Message** | L'expérience imposée et son corpus | **déjà en place** (passe 7) |
| **Contrôle** | Le faux positif « maxime » sur « Certaines agences dépassaient largement ce délai » | écrit |
| **Contrôle** | « Ouverture qui récite l'annonce » : signalée si le candidat n'apparaît qu'à la troisième phrase | écrit |
| **Contrôle** | « Catégorie au lieu d'un outil » : « ERP métier », « progiciels », « outils décisionnels » | écrit |
| **Contrôle** | « Ce constat a… », « Ce travail a… » ajoutés aux sujets non humains | écrit |

# Vérifié

- La lettre modèle **passe le contrôle de style sans aucun défaut**. C'est le
  test le plus important du lot : le prompt enseigne désormais par l'exemple, et
  un exemple qui déclenche un défaut enseigne le défaut.
- Le premier jet du contrôle « Ouverture » exigeait le « je » dès la phrase
  d'ouverture, et condamnait donc la lettre modèle. Un contrôle qui condamne sa
  propre référence est faux, pas sévère. Seuil corrigé à deux phrases.
- Sur la lettre in'li reçue le 1er octobre à 15 h, les contrôles disent
  maintenant : phrase sans sujet humain, 4 phrases sur 8 sans « je », ouverture
  qui récite l'annonce sur deux phrases, catégorie au lieu d'un outil.
- **121 tests.**
