# Étape 6 — Statuts, envois, relances, suivi

Spécification. Décisions D43 à D52.

---

## 1. Le problème

L'énumération `statut_offre` porte dix valeurs depuis l'étape 1. Aucune n'est
utilisée : toutes les offres sont restées à `enregistree` ou `analysee`.
Générer un CV, une lettre ou un email ne change rien. La page Candidatures,
qui filtre sur les statuts d'envoi, est donc vide par construction, et le
tableau de bord affiche des taux calculés sur zéro.

Il manque trois choses : que la préparation se voie, que l'envoi se déclare,
et que ce qui suit l'envoi se suive.

---

## 2. Ce qui change de statut tout seul, et ce qui ne change jamais tout seul

**D43 — La préparation avance automatiquement, et seulement vers l'avant.**
Générer un CV pose `cv_genere`, générer une lettre pose `lettre_generee`,
régénérer l'email pose `email_genere`. L'avancement est **monotone** : il ne
s'applique que si le statut cible est plus loin que le statut courant dans la
chaîne de préparation. Régénérer un CV après avoir écrit la lettre ne fait pas
reculer l'offre, et une offre déjà envoyée, en entretien, refusée, sans réponse
ou clôturée ne bouge plus jamais du fait d'une régénération.

La chaîne de préparation, dans l'ordre :
`enregistree` → `analysee` → `cv_genere` → `lettre_generee` → `email_genere`.

**D44 — `envoyee` ne s'atteint jamais autrement qu'à la main.** L'application
n'envoie aucun email et ne sait pas si une candidature est partie. Un seul
bouton, « Marquer comme envoyée », sur la fiche de l'offre. Il pose
`date_candidature` à l'instant du clic. Cette date reste modifiable : une
candidature envoyée hier et saisie aujourd'hui doit pouvoir porter la bonne
date, sinon le délai de relance est faux.

---

## 3. Après l'envoi

**D45 — Le suivi se déclare par un sélecteur, avec un commentaire facultatif.**
Quatre issues : Entretien, Refusée, Sans réponse, Offre clôturée. Le
commentaire libre est écrit sur la ligne d'historique correspondante — c'est là
que se note « relancé par téléphone, RH absente jusqu'au 12 » ou le motif d'un
refus.

**D46 — La relance a une date prévue, pas une alerte.** Marquer une offre
comme envoyée propose une relance à **dix jours**, modifiable et effaçable. Une
offre est « à relancer » quand elle est au statut `envoyee`, qu'elle porte une
date de relance et que cette date est atteinte. Aucune notification, aucun
email : la liste des relances dues s'affiche sur le tableau de bord.

**D47 — « Relancé aujourd'hui » repousse la prochaine relance de dix jours** et
incrémente un compteur. Le statut ne change pas : une relance n'est pas une
réponse. Le nombre de relances et la date de la dernière sont affichés sur la
fiche et sur la page Candidatures.

**D48 — L'historique est visible.** Une chronologie sur la fiche de l'offre,
lue depuis `statuts_historique`, avec la date, le statut et le commentaire.
Cette table est déjà alimentée par un déclencheur automatique depuis l'étape 1 :
rien à construire, seulement à afficher.

**D49 — Toute correction de statut reste possible, sans garde-fou.**
L'application a un seul utilisateur. Un sélecteur « Corriger le statut » permet
de poser n'importe quelle valeur, y compris en arrière. Une erreur de clic ne
doit pas être définitive — c'est la leçon des compétences écartées au niveau
zéro, invisibles et irrécupérables.

---

## 4. Ce que ça donne à l'écran

**D50 — Tableau de bord.** La liste des relances dues apparaît sous les
indicateurs, sous un titre « À relancer (n) », avec pour chaque offre son
intitulé, son entreprise, sa date d'envoi, le nombre de jours écoulés et le
nombre de relances déjà faites. Un compteur de plus dans la grille
d'indicateurs dirait le nombre sans dire lesquelles ; la liste dit les deux.
Elle disparaît quand elle est vide — une section affichée en permanence sans
contenu finit par ne plus être lue.

**D51 — Page Candidatures.** Chaque ligne porte désormais la date d'envoi, le
nombre de jours écoulés, l'état de la relance et le statut. Une offre à
relancer est signalée. La page reste filtrée sur les statuts d'envoi : une
offre préparée mais non envoyée n'y entre pas.

**D52 — Aucun envoi depuis l'application.** L'email reste copié à la main
depuis l'écran Lettre. Brancher une boîte mail ferait entrer des identifiants
et du courrier réel dans une application qui n'en a pas besoin pour faire son
travail.

---

## 5. Schéma

Migration `0006_suivi_candidature.sql`, trois colonnes sur `offres`, toutes
facultatives :

| Colonne | Type | Rôle |
|---|---|---|
| `relance_prevue_le` | `date` | la prochaine relance, nulle si aucune |
| `derniere_relance_le` | `date` | la dernière relance effectuée |
| `relances` | `int` (défaut 0) | combien de fois relancée |

Un index partiel sur `relance_prevue_le` pour les offres envoyées.

L'énumération `statut_offre`, la table `statuts_historique` et son déclencheur
ne changent pas.

---

## 6. Ce que l'étape ne fait pas

Pas d'envoi d'email, pas de connexion à une boîte mail, pas de notification,
pas de rappel par calendrier, pas de relance rédigée automatiquement. Le
scoring, la sélection du CV et la reformulation ne sont pas touchés.
