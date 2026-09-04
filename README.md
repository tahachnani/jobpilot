# JobPilot

Application privée de gestion et d'optimisation de recherche d'emploi.
Un seul utilisateur. Interface en français.

Deux volets distincts partagent le même moteur : **contrôle de gestion** et
**comptabilité**. Une base professionnelle unique alimente les deux, avec des
formulations et des visibilités propres à chacun.

---

## État du projet — Étape 1 sur 6

L'étape 1 livre le socle : base de données, sécurité, connexion, navigation.

### En place

- **17 tables**, 7 types énumérés, contraintes de cohérence des dates
- **Row Level Security active sur les 17 tables** : chaque ligne n'est lisible
  que par son propriétaire
- Bucket de stockage `documents` **privé**, accessible uniquement par URL signée
- Historisation automatique des changements de statut d'offre
- Barème de scoring version 1 et coefficients d'ancienneté enregistrés
  (alternance 1,00 · stage 0,50)
- Connexion par lien magique, une seule adresse autorisée, contrôle côté serveur
- Middleware redirigeant toute page non publique vers la connexion
- Navigation responsive : ordinateur, tablette, téléphone

### À venir

| Fonction | Étape |
|---|---|
| Base professionnelle extraite des CV, validée ligne par ligne | 2 |
| Ajout et analyse d'offres, score de compatibilité expliqué | 3 |
| Génération des CV personnalisés en PDF | 4 |
| Lettre de motivation et emails de candidature | 5 |
| Statuts, historique, statistiques, export | 6 |
| Marché caché (API publiques françaises) | V1.1 |

---

## Architecture

| Brique | Rôle |
|---|---|
| **Next.js 14** (App Router, TypeScript) | Interface et code serveur dans un seul projet |
| **Supabase** | PostgreSQL, stockage des PDF, authentification |
| **Vercel** | Hébergement et exécution. L'application tourne en ligne, ordinateur éteint |
| **API Anthropic** | Analyse et rédaction — à partir de l'étape 3 |
| **API France Travail** | Import d'offres structurées — à partir de l'étape 3 |

Un seul dépôt, un seul projet Vercel, un seul projet Supabase, une seule base
partagée entre développement et production, une seule branche `main`.

---

## Variables d'environnement

Aucune valeur n'est versionnée. Voir `.env.example`.

| Variable | Exposée au navigateur | Requise dès l'étape 1 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | oui | oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui, protégée par RLS | oui |
| `NEXT_PUBLIC_SITE_URL` | oui | oui |
| `EMAIL_AUTORISE` | **non** | oui |
| `ANTHROPIC_API_KEY` | **non** | étape 3 |
| `FRANCE_TRAVAIL_CLIENT_ID` / `_SECRET` | **non** | étape 3 |

En production, ces valeurs se saisissent dans Vercel → Settings → Environment
Variables, puis un redéploiement est nécessaire.

---

## Base de données

La migration `supabase/migrations/0001_socle.sql` est **idempotente** : elle peut
être rejouée sans erreur. Elle s'applique depuis le SQL Editor de Supabase, ou
via la CLI.

Une note sur la table `parametres` : sa colonne `owner_id` est volontairement
nullable. La migration s'exécute avec les droits d'administration, hors de toute
session utilisateur, où `auth.uid()` vaut `null`. Les paramètres sont de la
configuration applicative globale, pas des données personnelles, et leur
politique RLS accepte donc les lignes sans propriétaire.

---

## Développement local

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev
```

L'application est servie sur `http://localhost:3000`. Le développement local
partage la base de production : un seul utilisateur, pas de dérive de schéma.

Pour que le lien magique fonctionne en local, ajouter
`http://localhost:3000/auth/callback` aux Redirect URLs dans Supabase →
Authentication → URL Configuration.

---

## Principes de conception

- **Zéro invention.** L'IA ne peut renvoyer que des identifiants existant déjà
  en base. Un vérificateur contrôle en outre que chaque chiffre reformulé figure
  dans le texte source.
- **Scoring déterministe.** L'IA classe, le code calcule. Le même couple
  offre/profil produit toujours le même score, et le détail du calcul est
  affichable.
- **Une offre et une candidature sont le même objet.** Le cycle de vie va de
  « offre enregistrée » à « offre clôturée ». Le passage à « candidature
  envoyée » est exclusivement manuel : générer un document ne le déclenche
  jamais.
