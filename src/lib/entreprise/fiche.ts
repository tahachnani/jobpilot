import { creerClientServeur } from "@/lib/supabase/server";
import { appelIA, ErreurIA, MODELE_REDACTION } from "@/lib/anthropic";
import { extraireJson } from "@/lib/extraction-json";
import { documentationEntreprise, type Documentation } from "@/lib/entreprise/documentee";

/**
 * La fiche entreprise : ce qu'on sait de l'employeur, cherché une fois (D108).
 *
 * Le deuxième paragraphe de la lettre doit prouver qu'on s'est renseigné. Sans
 * source, un modèle y écrit « votre positionnement reconnu » et « vos projets
 * de transformation » — de la flatterie invérifiable, exactement ce que la
 * lettre bannit depuis le premier jour. Il faut donc de vrais faits, ou rien.
 *
 * Trois règles gouvernent la dépense, dans cet ordre :
 *
 * 1. **Une fiche déjà en base est réutilisée.** Elle est indexée par
 *    entreprise et non par offre : une régénération de lettre ne repaie rien,
 *    et une deuxième annonce chez le même employeur non plus.
 * 2. **Si l'annonce se suffit, on ne cherche pas.** Beaucoup d'annonces
 *    décrivent l'entreprise mieux qu'une recherche ne le ferait. La décision
 *    est arithmétique et gratuite — voir `documentee.ts`.
 * 3. **Sinon on cherche, deux recherches au maximum**, et le résultat est
 *    stocké pour ne plus jamais être repayé.
 *
 * La fiche sert la lettre, la préparation d'entretien, la relance et la fiche
 * d'offre. C'était la demande : une recherche, plusieurs usages.
 */

export interface FaitEntreprise {
  /** Le fait, en une phrase. */
  texte: string;
  /** L'adresse de la page qui le porte, pour pouvoir le vérifier. */
  source: string | null;
  /** L'année ou la date, quand elle est connue. Un fait daté se périme. */
  date: string | null;
}

export interface FicheEntreprise {
  entreprise: string;
  /** Ce que fait l'entreprise, en une phrase. */
  activite: string | null;
  /** Taille, effectif, périmètre — tel que trouvé, jamais estimé. */
  taille: string | null;
  implantation: string | null;
  /** Les faits utilisables dans une lettre : récents, concrets, vérifiables. */
  faits: FaitEntreprise[];
  /** Ce que la recherche n'a pas permis d'établir. Dit, pas comblé. */
  lacunes: string[];
}

export interface FicheLue {
  fiche: FicheEntreprise | null;
  /** 'web' : cherchée. 'annonce' : l'annonce suffisait. 'absente' : rien. */
  origine: "web" | "annonce" | "absente";
  /** Vrai si la fiche vient de la base et n'a donc rien coûté cette fois. */
  reutilisee: boolean;
  /** Ce que l'annonce dit de l'entreprise, toujours renseigné. */
  documentation: Documentation;
  /** Ce que cet appel a coûté. Zéro quand rien n'a été cherché. */
  coutUsd: number;
  /** L'âge de la fiche en jours, pour que l'écran puisse le dire. */
  ageJours: number | null;
}

/**
 * Au-delà de ce délai, une fiche est considérée comme vieille.
 *
 * Elle n'est pas effacée ni recherchée à nouveau d'office : l'activité et la
 * taille d'une entreprise ne changent pas en trois mois, et relancer
 * automatiquement reviendrait à repayer sans raison. L'écran le signale, et
 * un bouton permet de rafraîchir à la main.
 */
const PEREMPTION_JOURS = 120;

/**
 * Réduit un nom d'entreprise à sa clé de rapprochement.
 *
 * « IN'LI SAS », « in'li », « In'Li (Groupe Action Logement) » doivent tomber
 * sur la même fiche. Les formes juridiques et les parenthèses sautent ; le
 * reste est normalisé.
 */
export function cleEntreprise(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(s\.?a\.?s\.?u?|s\.?a\.?r\.?l|s\.?a\b|sci|scic|scop|eurl|snc|gie|groupe|sas|holding)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

const SYSTEME = `Tu établis une fiche factuelle sur une entreprise, à partir de recherches web, pour qu'un candidat puisse écrire une lettre de motivation qui montre qu'il s'est renseigné.

Tu cherches, dans cet ordre de priorité :
1. Ce que l'entreprise fait concrètement — son métier, ses produits, ses clients.
2. Sa taille et son périmètre : effectif, chiffre d'affaires, nombre de sites, zone géographique.
3. Des faits RÉCENTS et DATÉS : une acquisition, une ouverture, un changement d'organisation, un investissement, un résultat publié, un plan stratégique.

CE QUI EST UTILISABLE DANS UNE LETTRE, ET CE QUI NE L'EST PAS
Utilisable : « a ouvert un cinquième site logistique à Rennes en mars 2026 », « gère 80 000 logements intermédiaires en zones tendues », « a publié un plan de 300 M€ sur trois ans ».
Inutilisable, et donc à écarter : « est un acteur reconnu », « place l'humain au cœur de sa stratégie », « cultive des valeurs d'excellence ». Ces phrases viennent du site de l'entreprise, ne distinguent rien, et un recruteur les lit cinquante fois par semaine.

RÈGLES ABSOLUES
- Tu ne rapportes que ce que les pages trouvées affirment. Aucune déduction, aucune estimation, aucun ordre de grandeur « probable ».
- Chaque fait porte l'adresse de la page qui le soutient. Un fait sans source ne sort pas.
- Si tu ne trouves pas l'entreprise, ou si tu n'es pas certain qu'il s'agisse de la bonne — les homonymes sont fréquents — tu le dis dans "lacunes" et tu laisses les champs vides. Une fiche vide est utile ; une fiche fausse fait écrire une lettre fausse.
- Pas de données personnelles sur les dirigeants ou les salariés : le poste et le nom public d'un dirigeant suffisent, rien de privé.

Tu réponds UNIQUEMENT par un objet JSON, sans préambule ni balises de code :
{
  "activite": "une phrase, ou null",
  "taille": "effectif, CA, périmètre, tel que trouvé, ou null",
  "implantation": "siège et zone d'activité, ou null",
  "faits": [
    { "texte": "...", "source": "https://...", "date": "2026-03 ou null" }
  ],
  "lacunes": ["ce que la recherche n'a pas établi"]
}`;

/** Lit la fiche en base, sans rien chercher ni rien dépenser. */
export async function lireFiche(
  entreprise: string | null
): Promise<{ fiche: FicheEntreprise | null; origine: string; ageJours: number | null }> {
  if (!entreprise?.trim()) {
    return { fiche: null, origine: "absente", ageJours: null };
  }

  const supabase = creerClientServeur();
  const { data, error } = await supabase
    .from("recherches_entreprise")
    .select("entreprise, resultat, origine, updated_at")
    .eq("cle", cleEntreprise(entreprise))
    .maybeSingle();

  // Table absente — migration 0013 non lancée. Le reste doit continuer de
  // fonctionner : une lettre sans fiche est une lettre sans §2 documenté, pas
  // une erreur. La leçon du 21 septembre, encore : une colonne manquante ne
  // casse pas une ligne, elle vide un écran.
  if (error || !data) {
    return { fiche: null, origine: "absente", ageJours: null };
  }

  const ligne = data as {
    entreprise: string;
    resultat: Omit<FicheEntreprise, "entreprise">;
    origine: string;
    updated_at: string;
  };

  return {
    fiche: { entreprise: ligne.entreprise, ...ligne.resultat },
    origine: ligne.origine,
    ageJours: Math.floor(
      (Date.now() - new Date(ligne.updated_at).getTime()) / 86_400_000
    ),
  };
}

/**
 * La fiche d'une entreprise : lue, déduite de l'annonce, ou cherchée.
 *
 * @param forcer Relance la recherche même si une fiche existe. Réservé au
 * bouton « rafraîchir » : c'est le seul chemin qui repaie volontairement.
 */
export async function ficheOuRecherche(
  entreprise: string | null,
  contenuAnnonce: string | null,
  offreId?: string | null,
  forcer = false
): Promise<FicheLue> {
  const documentation = documentationEntreprise(contenuAnnonce);

  if (!entreprise?.trim()) {
    return {
      fiche: null,
      origine: "absente",
      reutilisee: false,
      documentation,
      coutUsd: 0,
      ageJours: null,
    };
  }

  // 1. Déjà en base : rien à payer, quel que soit le contenu de l'annonce.
  if (!forcer) {
    const { fiche, origine, ageJours } = await lireFiche(entreprise);
    if (fiche) {
      return {
        fiche,
        origine: origine === "annonce" ? "annonce" : "web",
        reutilisee: true,
        documentation,
        coutUsd: 0,
        ageJours,
      };
    }
  }

  // 2. L'annonce se suffit : on ne cherche pas (D109).
  //
  // Aucune fiche n'est enregistrée dans ce cas. Enregistrer « l'annonce
  // suffisait » empêcherait de chercher plus tard pour une autre annonce du
  // même employeur qui, elle, serait muette.
  if (!forcer && documentation.suffisante) {
    return {
      fiche: null,
      origine: "annonce",
      reutilisee: false,
      documentation,
      coutUsd: 0,
      ageJours: null,
    };
  }

  // 3. Recherche, deux au maximum, puis stockage définitif.
  const reponse = await appelIA({
    modele: MODELE_REDACTION,
    systeme: SYSTEME,
    message: [
      `ENTREPRISE : ${entreprise}`,
      contenuAnnonce
        ? `CE QUE L'ANNONCE EN DIT — pour lever les homonymes, et pour ne pas le rechercher :\n${contenuAnnonce.slice(0, 2500)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    maxTokens: 3000,
    tache: "recherche_entreprise",
    offreId: offreId ?? null,
    recherchesWeb: 2,
  });

  let brut: Omit<FicheEntreprise, "entreprise">;
  try {
    brut = JSON.parse(extraireJson(reponse.texte));
  } catch {
    throw new ErreurIA(
      "La fiche entreprise n'était pas exploitable. Début reçu : " +
        reponse.texte.trim().slice(0, 200)
    );
  }

  const fiche: FicheEntreprise = {
    entreprise,
    activite: brut.activite ?? null,
    taille: brut.taille ?? null,
    implantation: brut.implantation ?? null,
    // Un fait sans source ne sort pas : c'est la règle du prompt, appliquée
    // ici aussi, parce qu'une règle de prompt n'est jamais une garantie.
    faits: (brut.faits ?? []).filter((f) => f?.texte && f?.source).slice(0, 6),
    lacunes: (brut.lacunes ?? []).slice(0, 4),
  };

  const supabase = creerClientServeur();
  const { data: proprietaire } = await supabase.auth.getUser();
  const { activite, taille, implantation, faits, lacunes } = fiche;

  await supabase.from("recherches_entreprise").upsert(
    {
      owner_id: proprietaire.user?.id,
      entreprise,
      cle: cleEntreprise(entreprise),
      resultat: { activite, taille, implantation, faits, lacunes },
      origine: "web",
      recherches: reponse.recherchesWeb,
      cout_usd: reponse.coutUsd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,cle" }
  );

  return {
    fiche,
    origine: "web",
    reutilisee: false,
    documentation,
    coutUsd: reponse.coutUsd,
    ageJours: 0,
  };
}

/** La fiche mise à plat, pour un prompt. Vide si rien n'est connu. */
export function ficheEnTexte(fiche: FicheEntreprise | null): string {
  if (!fiche) return "";

  const lignes = [`CE QUE L'ON SAIT DE ${fiche.entreprise.toUpperCase()} :`];
  if (fiche.activite) lignes.push(`Activité : ${fiche.activite}`);
  if (fiche.taille) lignes.push(`Taille : ${fiche.taille}`);
  if (fiche.implantation) lignes.push(`Implantation : ${fiche.implantation}`);
  if (fiche.faits.length > 0) {
    lignes.push("Faits datés et sourcés :");
    for (const f of fiche.faits) {
      lignes.push(`  • ${f.texte}${f.date ? ` (${f.date})` : ""}`);
    }
  }
  if (fiche.lacunes.length > 0) {
    lignes.push(
      `Ce que la recherche n'a PAS établi, et qu'il ne faut donc pas affirmer : ${fiche.lacunes.join(" ; ")}`
    );
  }
  return lignes.join("\n");
}

export { PEREMPTION_JOURS };
