import { randomUUID } from "crypto";
import { creerClientServeur } from "@/lib/supabase/server";
import { appelIA, ErreurIA, MODELE_REDACTION } from "@/lib/anthropic";
import { VOLETS, type CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { ErreurCV } from "@/lib/cv/generer";
import { moisAnnee, periodeExperience } from "@/lib/cv/dates";
import { verifierAncrage, type Ancrage } from "@/lib/lettre/ancrage";
import {
  lettreEnTexte,
  rendreLettre,
  type ModeleLettre,
} from "@/lib/lettre/document";
import type { ModeleCV } from "@/lib/cv/modele";

/**
 * Génération de la lettre de motivation et de l'email de candidature.
 *
 * Un seul appel produit les deux : ils disent la même chose à deux longueurs,
 * et les faire séparément reviendrait à payer deux fois pour risquer qu'ils se
 * contredisent.
 */

const SYSTEME = `Tu rédiges une lettre de motivation et un email de candidature pour un professionnel du contrôle de gestion et de la comptabilité.

CE QUE TU PEUX INVENTER
L'intérêt pour l'entreprise, le secteur, le poste, le projet professionnel. Aucune donnée ne les porte, c'est à toi de les écrire — à partir de ce que dit l'annonce, et de rien d'autre.

CE QUE TU NE PEUX PAS INVENTER
- aucun chiffre, volume, pourcentage, durée qui ne soit dans le parcours fourni
- aucun employeur, école, diplôme, logiciel, outil, certification qui n'y soit
- aucune affirmation sur l'entreprise qui ne soit dans l'annonce : tu ne la connais pas. N'écris jamais qu'elle est "leader", "en forte croissance" ou "reconnue" si l'annonce ne le dit pas.
- aucun trait de caractère présenté comme démontré par un fait absent

CE QUE TU PRODUIS
Une lettre de trois à quatre paragraphes, une page maximum :
1. pourquoi cette offre et cette entreprise, à partir de l'annonce
2. ce que le parcours apporte de précis à ces missions-là, avec un ou deux faits tirés du parcours
3. ce qui distingue le candidat : un angle, une expérience, une double compétence
4. optionnellement, disponibilité et projet

Exigences de fond :
- pas de généralités interchangeables : chaque phrase doit être invalide pour une autre offre
- pas de recopie du CV, qui est joint : la lettre dit ce que la page n'a pas pu contenir
- verbe d'action, phrases courtes, vocabulaire du métier et de l'annonce
- pas de "Je suis passionné par", "dynamique et motivé", "n'hésitez pas", "au sein de votre prestigieuse"
- vouvoiement, registre professionnel français, jamais de superlatif sur soi

L'EMAIL
Cinq à huit lignes, sobre. Il annonce la candidature et les pièces jointes, donne une raison de lire la lettre, sans la répéter.

Tu réponds UNIQUEMENT par un objet JSON, sans préambule ni balises de code :
{
  "lettre": {
    "objet": "Objet : ...",
    "formuleAppel": "Madame, Monsieur,",
    "paragraphes": ["...", "...", "..."],
    "formulePolitesse": "..."
  },
  "email": { "objet": "...", "corps": "..." }
}`;

export interface ResultatLettre {
  documentLettreId: string;
  documentEmailId: string;
  version: number;
  modele: ModeleLettre;
  email: { objet: string; corps: string };
  ancrage: Ancrage;
  coutUsd: number;
}

function nettoyer(parties: (string | null | undefined)[], sep: string) {
  return parties
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(sep);
}

/** Le parcours complet, mis à plat pour le modèle. */
async function contexteParcours(volet: CodeVolet): Promise<{
  texte: string;
  corpus: string;
  profil: Record<string, string | null>;
}> {
  const supabase = creerClientServeur();

  const [profil, exps, comps, forms, langues, interets] = await Promise.all([
    supabase.from("profil").select("*").maybeSingle(),
    supabase
      .from("experiences")
      .select(
        `entreprise, ville, pays, date_debut, date_fin, type_contrat, ordre,
         titre_cdg, titre_compta,
         experience_periodes ( date_debut, date_fin, ordre ),
         missions ( actif, mission_formulations ( texte, volet, offre_id ) )`
      )
      .order("ordre"),
    supabase.from("competences").select("libelle, precision, niveau, categorie"),
    supabase.from("formations").select("diplome, etablissement, ville, date_debut, date_fin"),
    supabase.from("langues").select("langue, niveau, certification"),
    supabase.from("interets").select("libelle"),
  ]);

  const lignes: string[] = ["PARCOURS COMPLET", ""];

  for (const e of (exps.data ?? []) as Record<string, any>[]) {
    const titre =
      (volet === "cdg" ? e.titre_cdg : e.titre_compta) ??
      e.titre_cdg ??
      e.titre_compta ??
      "";
    const periodes = ((e.experience_periodes as Record<string, any>[]) ?? [])
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .map((p) => ({ dateDebut: p.date_debut, dateFin: p.date_fin }));
    lignes.push(
      `${titre} — ${e.entreprise} (${nettoyer([e.ville, e.pays], ", ")}) — ` +
        `${periodeExperience(e.date_debut, e.date_fin, periodes)} — ${e.type_contrat}`
    );
    for (const m of ((e.missions as Record<string, any>[]) ?? []).filter(
      (m) => m.actif !== false
    )) {
      const f = ((m.mission_formulations as Record<string, any>[]) ?? []).filter(
        (f) => !f.offre_id
      );
      const retenue = f.find((x) => x.volet === volet) ?? f[0];
      if (retenue?.texte) lignes.push(`  • ${retenue.texte}`);
    }
    lignes.push("");
  }

  lignes.push("FORMATIONS");
  for (const f of (forms.data ?? []) as Record<string, any>[]) {
    lignes.push(
      `  • ${f.diplome} — ${nettoyer([f.etablissement, f.ville], ", ")} — ` +
        `${moisAnnee(f.date_debut)} à ${moisAnnee(f.date_fin)}`
    );
  }

  lignes.push("", "COMPÉTENCES");
  for (const c of (comps.data ?? []) as Record<string, any>[]) {
    if ((c.niveau ?? 0) < 1) continue;
    lignes.push(
      `  • ${c.libelle}${c.precision ? ` (${c.precision})` : ""} — niveau ${c.niveau}/3 — ${c.categorie}`
    );
  }

  lignes.push("", "LANGUES");
  for (const l of (langues.data ?? []) as Record<string, any>[]) {
    lignes.push(`  • ${nettoyer([l.langue, l.niveau, l.certification], " — ")}`);
  }

  lignes.push("", "CENTRES D'INTÉRÊT");
  lignes.push(
    "  " +
      ((interets.data ?? []) as Record<string, any>[])
        .map((i) => i.libelle)
        .join(", ")
  );

  const texte = lignes.join("\n");
  return {
    texte,
    corpus: texte,
    profil: (profil.data as Record<string, string | null>) ?? {},
  };
}

export async function genererLettrePourOffre(
  offreId: string
): Promise<ResultatLettre> {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select(
      "id, volet, intitule, entreprise, localisation, contenu_brut, contact_nom, contact_adresse"
    )
    .eq("id", offreId)
    .maybeSingle();
  if (!offreBrute) throw new ErreurCV("Offre introuvable.");

  const offre = offreBrute as {
    volet: CodeVolet;
    intitule: string | null;
    entreprise: string | null;
    localisation: string | null;
    contenu_brut: string | null;
    contact_nom: string | null;
    contact_adresse: string | null;
  };

  const { data: analyseBrute } = await supabase
    .from("offre_analyses")
    .select("resultat")
    .eq("offre_id", offreId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!analyseBrute) {
    throw new ErreurCV(
      "Analyse l'offre avant de rédiger la lettre : sans elle, il n'y a rien à quoi répondre."
    );
  }
  const analyse = (analyseBrute as { resultat: OffreExtraite }).resultat;

  // Le CV déjà généré, pour que la lettre ne le répète pas.
  const { data: cvBrut } = await supabase
    .from("documents")
    .select("selection")
    .eq("offre_id", offreId)
    .eq("type", "cv")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const modeleCV = (cvBrut as { selection: { modele?: ModeleCV } } | null)
    ?.selection?.modele;

  const parcours = await contexteParcours(offre.volet);

  const message = [
    `ANNONCE INTÉGRALE :\n${(offre.contenu_brut ?? "").slice(0, 8000)}`,
    "",
    `POSTE VISÉ : ${offre.intitule ?? ""} chez ${offre.entreprise ?? ""}`,
    `VOLET : ${VOLETS[offre.volet].nom}`,
    "",
    `MISSIONS ATTENDUES : ${analyse.missions.map((m) => m.texte).join(" | ")}`,
    `COMPÉTENCES ATTENDUES : ${analyse.competences.map((c) => c.libelle).join(", ")}`,
    "",
    parcours.texte,
    "",
    modeleCV
      ? `DÉJÀ SUR LE CV, À NE PAS REDIRE MOT POUR MOT :\n${modeleCV.experiences
          .flatMap((e) => e.missions.map((m) => `  • ${m.texte}`))
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const reponse = await appelIA({
    modele: MODELE_REDACTION,
    systeme: SYSTEME,
    message,
    maxTokens: 3000,
    tache: "lettre_motivation",
    offreId,
  });

  let brut: {
    lettre: {
      objet: string;
      formuleAppel: string;
      paragraphes: string[];
      formulePolitesse: string;
    };
    email: { objet: string; corps: string };
  };
  try {
    const nettoye = reponse.texte
      .trim()
      .replace(/^```(?:json)?|```$/g, "")
      .trim();
    brut = JSON.parse(nettoye);
    if (!brut.lettre?.paragraphes?.length) throw new Error("format");
  } catch {
    throw new ErreurIA("La réponse du modèle n'était pas exploitable. Réessaie.");
  }

  const p = parcours.profil;
  const ville = (offre.localisation ?? "").split(",")[0].trim();
  const villeExpediteur = (p.localisation ?? "").split(",")[0].trim();

  const modele: ModeleLettre = {
    expediteur: [
      nettoyer([p.prenom, p.nom], " "),
      p.localisation ?? "",
      p.telephone ?? "",
      p.email ?? "",
    ].filter(Boolean),
    destinataire: [
      offre.entreprise ?? "",
      offre.contact_nom ?? "",
      offre.contact_adresse ?? "",
      ville,
    ].filter(Boolean),
    lieuDate: `${villeExpediteur || "France"}, le ${new Date().toLocaleDateString(
      "fr-FR",
      { day: "numeric", month: "long", year: "numeric" }
    )}`,
    objet: brut.lettre.objet,
    // Si le destinataire est connu, on s'adresse à lui ; sinon la formule
    // reste générique — mieux vaut neutre qu'un nom inventé.
    formuleAppel: offre.contact_nom
      ? brut.lettre.formuleAppel
      : "Madame, Monsieur,",
    paragraphes: brut.lettre.paragraphes,
    formulePolitesse: brut.lettre.formulePolitesse,
    signature: nettoyer([p.prenom, p.nom], " "),
    meta: { volet: offre.volet, genereLe: new Date().toISOString() },
  };

  // Ancrage : chaque fait vérifiable doit exister dans le parcours ou dans
  // l'annonce. Le résultat est signalé, jamais bloquant.
  const corpus = [parcours.corpus, offre.contenu_brut ?? "", offre.entreprise ?? ""].join(
    "\n"
  );
  const ancrage = verifierAncrage(
    [...modele.paragraphes, modele.objet].join("\n"),
    corpus
  );

  const { data: derniere } = await supabase
    .from("documents")
    .select("version")
    .eq("offre_id", offreId)
    .eq("type", "lettre")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((derniere as { version: number } | null)?.version ?? 0) + 1;

  const documentLettreId = randomUUID();
  const documentEmailId = randomUUID();
  const chemin = `lettre/${offreId}/${documentLettreId}.pdf`;

  const pdf = await rendreLettre(modele);
  const { error: erreurStockage } = await supabase.storage
    .from("documents")
    .upload(chemin, pdf, { contentType: "application/pdf", upsert: true });

  const { error } = await supabase.from("documents").insert([
    {
      id: documentLettreId,
      offre_id: offreId,
      type: "lettre",
      volet: offre.volet,
      version,
      storage_path: erreurStockage ? null : chemin,
      contenu_texte: lettreEnTexte(modele),
      selection: { modele, ancrage },
      cout_usd: reponse.coutUsd,
    },
    {
      id: documentEmailId,
      offre_id: offreId,
      type: "email",
      volet: offre.volet,
      version,
      contenu_texte: `${brut.email.objet}\n\n${brut.email.corps}`,
      selection: { email: brut.email },
      cout_usd: 0,
    },
  ]);

  if (error) {
    throw new ErreurCV(
      `La lettre a été rédigée mais n'a pas pu être enregistrée : ${error.message}`
    );
  }

  return {
    documentLettreId,
    documentEmailId,
    version,
    modele,
    email: brut.email,
    ancrage,
    coutUsd: reponse.coutUsd,
  };
}

/** Réenregistre une lettre corrigée à la main et recompose le PDF. */
export async function enregistrerLettreCorrigee(
  documentId: string,
  paragraphes: string[]
): Promise<void> {
  const supabase = creerClientServeur();

  const { data } = await supabase
    .from("documents")
    .select("id, offre_id, selection, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  const doc = data as {
    offre_id: string;
    selection: { modele?: ModeleLettre; ancrage?: Ancrage };
    storage_path: string | null;
  } | null;
  if (!doc?.selection?.modele) throw new ErreurCV("Lettre introuvable.");

  const modele: ModeleLettre = {
    ...doc.selection.modele,
    paragraphes: paragraphes.filter((p) => p.trim().length > 0),
  };

  const pdf = await rendreLettre(modele);
  const chemin = doc.storage_path ?? `lettre/${doc.offre_id}/${documentId}.pdf`;
  await supabase.storage
    .from("documents")
    .upload(chemin, pdf, { contentType: "application/pdf", upsert: true });

  await supabase
    .from("documents")
    .update({
      contenu_texte: lettreEnTexte(modele),
      selection: { ...doc.selection, modele },
      storage_path: chemin,
    })
    .eq("id", documentId);
}
