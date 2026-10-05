# Étape 5 — Lettre de motivation et email de candidature

Spécification à valider avant toute ligne de code.
Rédigée le 9 septembre 2026.

---

## Ce qui change de nature

Jusqu'ici, tout ce qui sortait de JobPilot venait d'une ligne validée. Le CV
recopie des formulations ; la reformulation redit la même chose avec d'autres
mots, et un contrôle arithmétique compare la proposition à l'original.

Une lettre part d'une page blanche. Il n'y a **rien à quoi la comparer**. Le
garde-fou de l'étape 4bis ne peut pas être réutilisé tel quel, et il faut le
remplacer par autre chose : un contrôle qui ne vérifie plus la fidélité à un
texte source, mais l'ancrage de chaque fait dans la base.

---

## Décisions

### D28 — La lettre s'appuie sur toute la base

Pas seulement sur les quatorze missions retenues au CV. La lettre peut
mobiliser une expérience, un chiffre ou une compétence que le CV a écartés
faute de place — c'est même une de ses raisons d'être : dire ce que la page
n'a pas pu contenir.

Le CV généré pour cette offre est joint au contexte, afin que la lettre ne
répète pas mot pour mot ce qu'il dit déjà.

### D29 — Le modèle écrit la motivation

L'intérêt pour l'entreprise, le secteur, le projet professionnel : aucune
donnée ne les porte, le modèle les rédige à partir de l'annonce. C'est assumé.

Deux limites strictes :
- **Aucun fait vérifiable inventé.** Pas de chiffre, pas d'employeur, pas
  d'outil, pas de diplôme, pas de durée qui ne soit dans la base.
- **Rien sur l'entreprise qui ne soit dans l'annonce.** Le modèle ne connaît
  pas cette société ; s'il affirme qu'elle est « leader de son marché » sans
  que l'annonce le dise, il ment sur un document signé.

### D30 — Structure de la lettre

Une page, même mise en page que le CV — Helvetica, une colonne.

1. **Expéditeur** — nom, adresse, téléphone, email, depuis `profil`
2. **Destinataire** — entreprise et localisation, depuis `offres`
3. **Lieu et date** — à droite, date de génération en toutes lettres
4. **Objet** — « Candidature au poste de [intitulé] »
5. **Formule d'appel**
6. **Corps** — trois à quatre paragraphes
7. **Formule de politesse**
8. **Signature** — prénom et nom

**À trancher :** la table `offres` ne contient ni adresse postale ni nom de
contact. Faut-il ajouter deux champs libres sur la fiche d'offre, que tu
remplis quand tu les connais ?
*Proposition : oui, deux champs facultatifs. À défaut, l'en-tête se limite au
nom de l'entreprise et à sa ville, et la formule d'appel reste « Madame,
Monsieur ».*

### D31 — Le contrôle automatique

Sans texte source, on vérifie l'**ancrage**. Déterministe, sans IA.

Sont extraits de la lettre puis confrontés à la base et à l'annonce :

- **les nombres** — chaque chiffre doit exister dans une mission, une
  formation, une durée d'expérience, ou dans l'annonce
- **les noms propres et sigles** — chaque employeur, outil, école ou logiciel
  cité doit exister dans la base ou dans l'annonce

Tout élément non ancré est **signalé, surligné dans le texte**, mais ne bloque
pas : contrairement à une reformulation, une lettre ne peut pas être rejetée en
bloc pour un mot. Tu vois ce qui n'est adossé à rien, et tu tranches.

### D32 — La validation se fait d'un bloc

Un écran, la lettre entière dans un champ modifiable, les éléments non ancrés
signalés à côté. Tu corriges librement, tu enregistres, le PDF est composé.

Pas de découpage par paragraphe : une lettre se lit d'une traite, et valider
un paragraphe isolément n'a pas de sens quand c'est l'enchaînement qui fait la
qualité.

### D33 — L'email de candidature

Généré dans le même appel que la lettre, à partir du même contexte. Cinq à huit
lignes, ton sobre, objet inclus. Il annonce les pièces jointes sans redire la
lettre.

Stocké en `documents` avec `type = 'email'`, copiable en un clic. Pas de PDF.

### D34 — Modèle, coût, versions

Claude Sonnet, un appel unique produisant la lettre et l'email. Coût
enregistré dans `documents.cout_usd`.

Chaque génération crée une version, comme pour le CV. Rien n'est écrasé.

### D35 — Aucune migration

`type_document` contient déjà `cv`, `lettre`, `email`. `statut_offre` contient
déjà `lettre_generee` et `email_genere`. La table `documents` porte
`contenu_texte`, `storage_path`, `version` et `cout_usd`.

Seule la décision D30 pourrait ajouter deux colonnes à `offres`.

---

## Hors périmètre

- Le changement de statut de l'offre — étape 6
- Les relances et le suivi des candidatures — étape 6
- L'envoi effectif des emails : JobPilot prépare, tu envoies

---

## Points ouverts à trancher

| # | Question | Proposition |
|---|---|---|
| D30 | Champs contact et adresse sur la fiche d'offre | Oui, deux champs facultatifs |
| D31 | Un élément non ancré bloque-t-il ? | Non, il est signalé |
| D33 | L'email dans le même appel que la lettre | Oui |
