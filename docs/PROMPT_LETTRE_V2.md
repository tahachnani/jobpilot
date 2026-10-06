# Lettre et messages — proposition de refonte

> **À valider avant application.** Rien n'est codé. Trois décisions t'attendent
> à la fin, et le texte complet du nouveau prompt est au milieu.

---

## 1. Ce que j'ai trouvé, et qui n'est pas une question de style

### Défaut A — l'expérience n'est pas classée du tout

Le prompt affirme : « L'EXPÉRIENCE T'EST IMPOSÉE : c'est celle que le moteur a
classée la plus proche de cette offre ». Le code, lui, fait ceci :

```ts
const retenues = choisirNiveau(...).selection.experiences
  .filter((e) => e.missions.length > 0);
const aRaconter = retenues[0] ?? null;
```

`selection.experiences` est construit par `donnees.experiences.map(…)` —
**l'ordre du profil, c'est-à-dire l'ordre chronologique**. Aucun tri face à
l'offre n'a lieu. `retenues[0]` est donc, à chaque fois, *la plus récente
expérience qui porte au moins une mission* : Le Mans Métropole Habitat, CDD,
toujours.

C'est pour ça que toutes tes lettres parlent de LMMH. Ce n'est pas un penchant
du modèle, c'est un tri qui n'existe pas.

### Défaut B — le secteur ne pèse rien dans ce choix

L'offre DIM est classée `industrie_textile`. TRIUMPH, à Fès, est classé
`industrie_textile` — c'est le **même secteur**, de la lingerie dans les deux
cas. Rien dans la chaîne de la lettre ne lit `secteur_code` : la sélection ne
compare que des codes d'activité.

Même si le défaut A était corrigé, la lettre n'aurait aucune raison de préférer
TRIUMPH. Il faut que la proximité sectorielle entre dans le classement.

### Défaut C — aucune recherche entreprise ne part jamais

`ficheOuRecherche` n'est appelée **qu'au bouton « Réanalyser »**
(`offre/[id]/actions.ts:200`). Le chemin normal — ajouter une offre, elle
s'analyse — ne l'appelle nulle part :

```
src/app/(app)/[volet]/offres/ajouter/actions.ts
  extraireOffre ✓   enregistrerScore ✓   ficheOuRecherche ✗
```

En base, `recherches_entreprise` contient **deux lignes**, du 2 et du 4 octobre,
et plus rien depuis. Les dix-sept lettres écrites depuis ont donc toutes eu un
§2 sans matière — d'où tes « deux lignes ».

Quand D118 a déplacé la recherche de la rédaction vers l'analyse, elle n'a été
rebranchée que sur la réanalyse. Ce n'est pas un réglage, c'est un fil coupé.

### Et un quatrième, que j'ai écrit moi-même

Le §3 du prompt dit, mot pour mot :

> « Tu racontes **UNE SEULE** situation, en entier […] Un fait développé
> convainc ; quatre faits empilés sont le CV recopié. »

Ta remarque — « il faut parler d'un parcours, pas d'une seule expérience ni
d'une seule mission » — contredit directement cette consigne. Elle vient d'un
constat réel (la lettre récitait le CV), mais la correction est allée trop loin
dans l'autre sens.

---

## 2. Ce que ta lettre modèle fait, et que l'App ne fait pas

| | Ta lettre ARTEA | La lettre DIM générée |
|---|---|---|
| Expériences citées | LMMH + « mes expériences » au pluriel | LMMH seule |
| Éléments concrets | quittancement, contrôle de facturation, analyse des écarts, extractions — **4** | valorisation des résidences — **1** |
| Place de la plus longue | 2 lignes | **6 lignes, tout le §3** |
| Outils | une phrase dédiée | noyés dans le §4 |
| Entreprise | un paragraphe sur ce qui l'intéresse dans le poste | une phrase |

Ta lettre nomme peu de choses mais en nomme **plusieurs**, chacune en une
proposition. C'est ça, « un parcours ».

Un point d'honnêteté : ta lettre écrit « Sérieux, méthodique et curieux » et
« être rigoureux ». Le prompt actuel **interdit** les qualités de caractère,
parce qu'elles sont invérifiables. C'est une des trois décisions ci-dessous.

---

## 3. Les règles mécaniques proposées (hors prompt)

Ce que le code décide, et que le modèle n'a pas à arbitrer.

**R1 — classer les expériences face à l'offre.** Note d'une expérience =
somme des notes de ses missions retenues (le barème existe déjà), **plus une
prime de proximité sectorielle** : secteur identique +40, même famille +15,
rien sinon. Sur DIM, TRIUMPH passe devant LMMH ; sur un bailleur social, LMMH
reste devant.

**R2 — nommer deux expériences au lieu d'une.** Le message de rédaction porte
la **première** expérience du classement avec ses situations, et la
**deuxième** avec ses deux meilleures lignes seulement. Le §3 doit s'appuyer
sur les deux.

**R3 — rebrancher la recherche entreprise** sur le chemin d'ajout, comme sur la
réanalyse. Coût inchangé : une fiche par employeur, réutilisée ensuite.

**R4 — l'écran dit ce qu'il a fait.** Après analyse, la fiche d'offre affiche
« fiche entreprise : trouvée / l'annonce suffisait / échec », pour que tu ne
découvres plus l'absence dans la lettre.

---

## 4. Le nouveau §3, au mot près

Remplace tout le paragraphe « §3 — LE CANDIDAT » actuel.

> **§3 — LE PARCOURS (environ 800 signes)**
>
> C'est le paragraphe qui porte la lettre, et il parle d'un **parcours**, pas
> d'une mission.
>
> DEUX EXPÉRIENCES AU MOINS. Le message te donne les expériences classées face
> à cette offre, la première avec ses situations détaillées, la seconde avec
> ses lignes principales. Tu nommes les deux employeurs. La première occupe
> plus de place que la seconde, pas toute la place.
>
> TROIS À QUATRE ÉLÉMENTS CONCRETS, pris dans ces deux expériences. Un élément
> tient en une proposition : « le contrôle mensuel du quittancement d'un
> patrimoine de 18 000 logements », « l'analyse des écarts entre charges
> prévisionnelles et quittancées ». Tu ne les présentes pas en liste : ils
> s'enchaînent dans des phrases.
>
> DEUX PHRASES AU MAXIMUM SUR UN MÊME ÉLÉMENT. C'est la règle qui empêche le
> paragraphe de se refermer sur une seule anecdote. Si tu as besoin de quatre
> phrases pour faire comprendre une situation, c'est qu'elle est trop
> particulière pour cette lettre : prends-en une autre.
>
> UN SEUL ÉLÉMENT EST DÉVELOPPÉ — celui que le classement met en tête — et
> « développé » veut dire deux phrases : ce qu'il y avait à régler, ce que le
> candidat a fait. Les autres sont nommés en passant.
>
> LE CANDIDAT EST SUJET. « J'ai construit », « je contrôlais », « j'ai
> rapproché ». Jamais « ce travail a permis ».
>
> Si la matière fournie porte un chiffre, la lettre le porte. Un seul suffit.
>
> CE QUE CE PARAGRAPHE N'EST PAS : une liste de missions recopiée du CV. La
> différence tient à l'enchaînement — un parcours se raconte dans un ordre qui
> a un sens pour cette offre-là, un CV s'énumère.

Et une phrase à ajouter en section 1 (les faits) :

> LES EXPÉRIENCES TE SONT CLASSÉES, SECTEUR COMPRIS. Si le message signale que
> la première expérience partage le secteur de l'entreprise visée, c'est elle
> qui ouvre le paragraphe, et le secteur se dit. Un recruteur de la lingerie
> qui lit « dans une usine de lingerie » n'a plus besoin d'être convaincu que
> le candidat connaît son environnement.

---

## 5. Les deux messages courts

Ta remarque : « dire que durant 6 mois j'ai fait nanani nanana ne met pas en
valeur les autres expériences ». C'est le même défaut que le §3, hérité de la
même consigne.

> **"court" — 380 à 450 signes.** Le poste, **deux** éléments du parcours pris
> dans deux expériences différentes, la disponibilité. Pas de récit : deux
> propositions nominales suffisent. Rien sur l'entreprise.
>
> **"moyen" — 800 à 900 signes.** Le poste et ce qu'il demande ; le parcours en
> trois à quatre éléments, dont un seul développé en deux phrases ; les outils
> nommés ; la disponibilité. Les mêmes règles de parcours que le §3 de la
> lettre s'y appliquent — c'est le même candidat qui écrit.
>
> AUCUN MESSAGE NE CONSACRE PLUS DE LA MOITIÉ DE SA LONGUEUR À UNE SEULE
> EXPÉRIENCE.

---

## 6. Les contrôles automatiques correspondants

Ajoutés à `style.ts`, qui en porte déjà quatorze. Ils ne bloquent rien, ils
signalent — comme les autres.

| Contrôle | Se déclenche quand | Pourquoi |
|---|---|---|
| **Parcours étroit** | le §3 ne nomme qu'un seul employeur | le défaut que tu signales, attrapé directement |
| **Mission monopolisante** | plus de 2 phrases du §3 portent sur le même élément | empêche le retour de l'anecdote unique |
| **Secteur ignoré** | l'offre et une expérience partagent le secteur, et cette expérience n'est pas citée | le cas DIM / TRIUMPH |
| **Entreprise muette** | le §2 fait moins de 120 signes **et** aucune fiche n'existait | distingue « rien à dire » de « rien cherché » |
| **Message déséquilibré** | un message court consacre plus de la moitié de sa longueur à une expérience | ta remarque sur les messages |

Les trois premiers se vérifient sans IA : on compare les noms d'employeurs et
les codes secteur du dossier au texte produit.

---

## 7. Trois décisions pour toi

**D1 — les qualités de caractère.** Ta lettre ARTEA écrit « Sérieux,
méthodique et curieux » ; le prompt les interdit depuis le début, au motif
qu'elles sont invérifiables et qu'un recruteur les lit cinquante fois par
semaine. Je peux : *(a)* maintenir l'interdiction ; *(b)* en autoriser une
seule, en clôture du §4, comme dans ta lettre. **Mon avis : (a)**, mais c'est
ta signature, pas la mienne.

**D2 — la formation en ouverture.** Ta lettre commence par « Titulaire d'un
Master 2 en Contrôle de Gestion et Audit Organisationnel ». Le prompt
l'interdit aujourd'hui (règle du « jamais deux masters », jamais
d'établissement). Autoriser la **spécialité seule** en ouverture du §1 est
cohérent avec ta pratique et ne nomme aucune université. **Mon avis :
autoriser.**

**D3 — quatre ou cinq paragraphes.** Ta lettre en a cinq : objet+formation,
parcours, outils+méthode, entreprise+poste, clôture. La structure actuelle en a
quatre et c'est toi qui l'avais dictée. Le §3 nouvelle version absorbe les
outils, donc quatre suffisent. **Mon avis : rester à quatre.**

---

## 8. Ce que je fais ensuite

Sur ton accord : R1 à R4 dans le code, le prompt réécrit avec le §3 et les
messages ci-dessus, les cinq contrôles, puis **je régénère la lettre DIM et je
te la montre avant de livrer**. Si elle ne parle pas de TRIUMPH et de la
lingerie, c'est que quelque chose ne marche toujours pas, et on le saura avant
que tu paies une génération.
