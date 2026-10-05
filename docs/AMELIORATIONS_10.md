# Dix améliorations — décisions D53 à D62

Passe d'amélioration après l'étape 6. Quatre décisions ont été arbitrées
directement (D53, D56, D55, D59) ; les autres suivent la logique déjà posée
dans les étapes précédentes.

---

## Fiabilité

**D53 — Le coût IA affiché est le coût réel, et le plafond avertit sans
bloquer.** Le tableau de bord écrivait « 0,00 $ » en dur sous la mention
« plafond 10 $ », alors que `appels_ia` journalise chaque appel avec son coût
depuis l'étape 1. Le cumul du mois est désormais lu, avec le nombre d'appels
et les échecs. Un bandeau apparaît à 80 % du plafond, un autre au
dépassement — mais **rien n'est jamais empêché** : être bloqué devant une
offre qui ferme le lendemain coûterait plus cher que quelques dollars.

**D54 — Une seule fonction d'extraction de JSON.** Deux coexistaient, et
c'était la plus fragile qui servait à l'extraction d'offre. `analyserJson`
s'appuie désormais sur `extraction-json`, qui gère aussi les tableaux et se
repère sur les délimiteurs. Le plafond de jetons de l'extraction passe de 4000
à 8000 : 4000 a été la limite exacte de trois troncatures ailleurs.

**D55 — Les tests bloquent en local, jamais sur Vercel.** `npm run build`
exécute `npm test` avant de construire ; sur Vercel, le lanceur se retire de
lui-même. Un test mal écrit ne peut donc pas empêcher un déploiement urgent,
mais une régression ne peut plus partir sans avoir été vue. Aucune dépendance
ajoutée : Node exécute le TypeScript directement, et les chemins `@/…` passent
par un crochet de résolution maison. Quarante cas couvrent le contrôle de
reformulation, le barème, l'ordre des compétences, l'estimateur de page, la
comparaison de termes et le suivi.

**D56 — Trois versions conservées par document, purge automatique.**
Régénérer est gratuit, donc encouragé — et chaque clic laissait une ligne et
un PDF de plus, que rien n'effaçait. Au-delà des trois dernières versions, les
anciennes partent avec leur fichier. La version courante en fait toujours
partie : un CV déjà envoyé reste téléchargeable tel qu'il est parti.

**D57 — Ce qui est écrit dans `documents.selection` porte son numéro de
forme.** `schema: 3` est posé à l'écriture. Les lecteurs devinaient la forme en
testant la présence de chaque clé, après qu'un document d'avant l'étape 4ter a
fait planter l'écran Formulations.

---

## Fonctionnalités

**D58 — Les paramètres s'éditent depuis l'écran, et le barème incrémente sa
version tout seul.** Un JSON invalide est refusé avant d'atteindre la base. Dès
que le contenu du barème change, sa version passe au numéro suivant — sinon des
scores calculés différemment cohabitent sans que rien ne le dise. Un bouton
renote toutes les offres à partir de leur analyse stockée, sans aucun appel IA.

**D59 — Sauvegarde exportable, import strictement additif.** Un JSON
téléchargeable contient le profil, les expériences, les missions, les
formulations, le corpus, les offres, les analyses, les scores, l'historique et
les paramètres. Les PDF n'y sont pas : ils se régénèrent. L'import **ajoute ce
qui manque et ne modifie jamais ce qui existe** : il restaure entièrement une
base vide et ne peut pas abîmer une base pleine. `owner_id` est retiré à
l'import, si bien qu'une sauvegarde se réinjecte dans un projet Supabase neuf.

**D60 — La relance est rédigée par l'application.** L'étape 6 savait qu'il
fallait relancer et quand, mais laissait écrire le message. Le modèle reçoit
le poste, l'entreprise, la date d'envoi, le rang de la relance et la lettre
envoyée — **seule source de faits autorisée** : six lignes au maximum, aucun
chiffre qui ne soit pas déjà dans la candidature, aucun ton de reproche.
Rédiger et déclarer « Relancé aujourd'hui » restent deux gestes distincts : on
relit avant d'envoyer.

**D61 — La liste d'offres se filtre et se trie.** Cinq filtres — En cours, À
envoyer, Envoyées, À relancer, Toutes — et trois tris. Le filtre par défaut
masque les offres refusées, sans réponse et clôturées. Les choix vivent dans
l'URL : le retour arrière fonctionne et un tri se met en signet.

**D62 — Passe tactile.** Sur petit écran, les champs repassent à 16 px : en
deçà, iOS zoome à la mise au point et la page reste zoomée. Les boutons
reçoivent une hauteur minimale, et les missions d'une expérience se replient
comme le corpus — la page Mon profil faisait plusieurs mètres de défilement sur
une tablette.

---

## Migrations

- `0005_corpus_experience.sql` — **reconstituée**. Elle avait été appliquée
  directement dans l'éditeur SQL à l'étape 4ter sans être versionnée, et le
  dépôt sautait de 0004 à 0006. Sans elle, une sauvegarde réimportée dans un
  projet neuf n'aurait nulle part où mettre le corpus. Sans effet sur la base
  existante.
- `0007_relance_et_index.sql` — ajoute `relance` à l'énumération
  `type_document`. Une relance est un email, mais pas l'email de candidature :
  mélangés dans le même type, le dernier écrirait par-dessus l'autre. À lancer
  **seul** dans l'éditeur SQL, `add value` n'acceptant pas d'être dans une
  transaction.

---

## D63 — Une qualité comportementale compte pour moitié

Ajoutée après coup, sur constat d'usage : une offre affichait « Polyvalence —
absente de ta base » à 0, alors que l'application **refuse** de proposer ce
libellé à l'ajout, le jugeant trop générique pour valoir une ligne de CV. Deux
modules, deux définitions de ce qui compte comme compétence : le score
facturait ce que le profil n'avait aucun moyen d'acquérir.

Les deux s'appuient désormais sur la même fonction, `estSavoirFaire`. Une
qualité comportementale pèse la moitié d'un savoir-faire de même caractère, et
son absence ne plafonne plus le score global. Réduit plutôt qu'annulé : un
recruteur qui met la polyvalence en tête de son annonce dit quelque chose du
poste — cela doit peser, sans jamais faire basculer un score.

Le barème passe en **version 4**. Toutes les offres sont à renoter depuis
l'écran Paramètres après déploiement : 23 des 25 scores existants dataient
encore de la version 2 et n'étaient donc comparables ni entre eux, ni aux
nouveaux.

---

## Ce que cette passe ne fait pas

Aucun changement de la sélection des missions, du contrôle de reformulation ni
de la composition du CV. Le scoring ne change que sur le point D63, validé
explicitement. Les tests figent ces comportements tels qu'ils sont
aujourd'hui.
