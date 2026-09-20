import { creerClientServeur } from "@/lib/supabase/server";
import { appelIA, analyserJson, ErreurIA, MODELE_REDACTION } from "@/lib/anthropic";
import { ErreurCV } from "@/lib/cv/generer";
import { purgerAnciennesVersions } from "@/lib/documents";
import { jour, joursDepuis } from "@/lib/suivi";

/**
 * L'email de relance.
 *
 * L'étape 6 sait qu'une candidature doit être relancée et à quelle date, mais
 * laissait écrire le message. Toute la matière est pourtant là : le poste,
 * l'entreprise, la date d'envoi, le nombre de relances déjà faites et la
 * lettre envoyée.
 *
 * Les règles sont plus strictes que pour la lettre. Une relance qui répète la
 * candidature agace ; une relance qui invente un fait se contredit avec ce qui
 * a déjà été envoyé. Le modèle n'a donc le droit qu'à ce qui est dans la
 * lettre d'origine, et à rien d'autre.
 */

export interface Relance {
  objet: string;
  corps: string;
}

const SYSTEME = `Tu écris des emails de relance de candidature, en français, pour un candidat en contrôle de gestion et comptabilité.

RÈGLES ABSOLUES :
- Six lignes maximum, idéalement quatre. Une relance longue ne se lit pas.
- Tu n'avances aucun fait qui ne soit pas dans la candidature d'origine fournie : ni chiffre, ni employeur, ni diplôme que tu n'y lis pas.
- Tu ne répètes pas la lettre de motivation. Tu rappelles l'objet en une phrase et tu redis la disponibilité.
- Pas de reproche, pas d'insistance, pas de formule d'urgence. Pas de "je me permets de", pas de "sauf erreur de ma part".
- Tu réponds uniquement par un objet JSON, sans texte autour, sans balises de code.

FORMAT DE RÉPONSE :
{ "objet": string, "corps": string }

PRÉCISIONS :
- L'objet reprend l'intitulé du poste et signale qu'il s'agit d'un suivi.
- Le corps commence par "Bonjour," et finit par une formule courte suivie du nom du candidat.
- S'il s'agit d'une deuxième relance ou plus, le ton reste identique : on ne durcit pas.`;

export async function genererRelancePourOffre(
  offreId: string
): Promise<{ relance: Relance; version: number; coutUsd: number }> {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select(
      "id, volet, intitule, entreprise, contact_nom, date_candidature, relances, derniere_relance_le"
    )
    .eq("id", offreId)
    .maybeSingle();

  if (!offreBrute) throw new ErreurCV("Offre introuvable.");
  const offre = offreBrute as {
    volet: string;
    intitule: string | null;
    entreprise: string | null;
    contact_nom: string | null;
    date_candidature: string | null;
    relances: number | null;
    derniere_relance_le: string | null;
  };

  if (!offre.date_candidature) {
    throw new ErreurCV(
      "Cette offre n'est pas marquée comme envoyée : il n'y a rien à relancer."
    );
  }

  const { data: lettreBrute } = await supabase
    .from("documents")
    .select("contenu_texte")
    .eq("offre_id", offreId)
    .eq("type", "lettre")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lettre =
    (lettreBrute as { contenu_texte: string | null } | null)?.contenu_texte ?? "";

  const { data: profilBrut } = await supabase
    .from("profil")
    .select("prenom, nom, email, telephone")
    .limit(1)
    .maybeSingle();
  const profil = (profilBrut ?? {}) as {
    prenom?: string;
    nom?: string;
    email?: string;
    telephone?: string;
  };

  const rang = (offre.relances ?? 0) + 1;
  const jours = joursDepuis(offre.date_candidature);

  const message = `CANDIDATURE À RELANCER

Candidat : ${[profil.prenom, profil.nom].filter(Boolean).join(" ") || "—"}
Poste : ${offre.intitule ?? "—"}
Entreprise : ${offre.entreprise ?? "—"}
Interlocuteur : ${offre.contact_nom ?? "inconnu, ne pas inventer de nom"}
Candidature envoyée le : ${jour(offre.date_candidature)}${
    jours !== null ? ` (il y a ${jours} jours)` : ""
  }
Relance numéro : ${rang}${
    offre.derniere_relance_le
      ? ` — précédente relance le ${jour(offre.derniere_relance_le)}`
      : ""
  }

LETTRE DE MOTIVATION ENVOYÉE (seule source de faits autorisée) :
${lettre || "Aucune lettre enregistrée : n'avance alors aucun fait chiffré."}

Rédige la relance.`;

  const reponse = await appelIA({
    modele: MODELE_REDACTION,
    systeme: SYSTEME,
    message,
    // Large : le modèle produit un raisonnement invisible compté en sortie, et
    // trois troncatures de cette application ont eu exactement cette cause.
    maxTokens: 8000,
    tache: "relance",
    offreId,
  });

  const brut = analyserJson<Partial<Relance>>(reponse.texte);
  if (!brut.objet || !brut.corps) {
    throw new ErreurIA(
      `La relance rendue est incomplète. Début reçu : ${reponse.texte.slice(0, 200)}`
    );
  }

  const relance: Relance = {
    objet: String(brut.objet).trim(),
    corps: String(brut.corps).trim(),
  };

  const { data: derniere } = await supabase
    .from("documents")
    .select("version")
    .eq("offre_id", offreId)
    .eq("type", "relance")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = ((derniere as { version: number } | null)?.version ?? 0) + 1;

  await supabase.from("documents").insert({
    offre_id: offreId,
    type: "relance",
    volet: offre.volet,
    version,
    contenu_texte: `${relance.objet}\n\n${relance.corps}`,
    selection: { relance, rang },
    cout_usd: reponse.coutUsd,
  });

  await purgerAnciennesVersions(offreId, "relance");

  return { relance, version, coutUsd: reponse.coutUsd };
}
