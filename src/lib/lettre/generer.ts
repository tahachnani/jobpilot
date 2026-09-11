import { randomUUID } from "crypto";
import { creerClientServeur } from "@/lib/supabase/server";
import { appelIA, ErreurIA, MODELE_REDACTION } from "@/lib/anthropic";
import { VOLETS, type CodeVolet } from "@/config/volets";
import type { OffreExtraite } from "@/lib/extraction-offre";
import { ErreurCV } from "@/lib/cv/generer";
import { moisAnnee, periodeExperience } from "@/lib/cv/dates";
import { extraireJson } from "@/lib/extraction-json";
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

LA DATE ET LA DISPONIBILITÉ
La date du jour t'est donnée. Tu en tires les temps : une expérience achevée se raconte au passé, jamais au présent. N'écris jamais "actuellement en poste" pour un contrat déjà terminé.

Pour la disponibilité, si le dernier contrat est terminé, tu écris exactement l'idée "disponible immédiatement" et RIEN D'AUTRE sur le sujet. La phrase de disponibilité ne nomme ni la date de fin du dernier contrat, ni son employeur, ni sa nature. Interdit : "Mon CDD chez X s'est achevé en juin 2026, je suis disponible immédiatement." Attendu : "Disponible immédiatement, je ...". La date de fin figure sur le CV ; la répéter dans la lettre ne fait que souligner l'intervalle écoulé.

Si un contrat est en cours, alors seulement tu donnes sa date de fin.

À VÉRITÉ ÉGALE, CHOISIS LA FORMULATION QUI SERT
Quand plusieurs façons de dire sont également exactes, retiens celle qui sert la candidature. Taire un détail sans intérêt n'est pas mentir ; l'inventer, si.

CE QUE TU NE PEUX PAS INVENTER
- aucun chiffre, volume, pourcentage, durée qui ne soit dans le parcours fourni
- aucun employeur, école, diplôme, logiciel, outil, certification qui n'y soit
- aucune affirmation sur l'entreprise qui ne soit dans l'annonce : tu ne la connais pas. N'écris jamais qu'elle est "leader", "en forte croissance" ou "reconnue" si l'annonce ne le dit pas.
- aucun trait de caractère, aucune qualité relationnelle, aucune manière de travailler présentés comme acquis : "habitué à défendre un chiffre avec diplomatie", "reconnu pour sa rigueur" sont des affirmations invérifiables. Décris ce qui a été fait, pas la façon dont le candidat le ferait.
- aucun secteur, marché ou métier attribué à un employeur du parcours s'il n'est pas nommément dans les données. Si l'annonce parle de distribution et que le candidat a travaillé dans l'industrie, tu n'écris pas qu'il vient de la distribution. Les mots de l'annonce décrivent l'entreprise visée, jamais rétroactivement le parcours.

CE QUE TU PRODUIS
Une lettre de quatre paragraphes, une page maximum, qui progresse. Elle ne commence JAMAIS par "Votre annonce", "Votre offre" ni par une description de l'entreprise : on se présente avant de commenter autrui.

1. QUI EST LE CANDIDAT, et pourquoi ce poste précisément. Une phrase d'ouverture qui pose le profil — formation, ancrage métier, situation — puis le lien avec le poste visé. On part de soi, on arrive à l'offre.
2. CE QUE LE PARCOURS APPORTE à ces missions-là, avec deux faits précis tirés des expériences. C'est le cœur, le paragraphe le plus dense.
3. CE QUI DISTINGUE : un angle, une double compétence, une expérience que d'autres candidats n'auront pas. C'est ici que la lettre dit ce que le CV ne peut pas dire.
4. DISPONIBILITÉ ET PROJET, bref, tourné vers la suite.

Chaque paragraphe doit être plus engageant que le précédent. Le dernier appelle un entretien sans le quémander.

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

  // Sans la date du jour, le modèle a écrit « actuellement en poste jusqu'en
  // juin 2026 » trois mois après la fin du contrat. Il ne pouvait pas le
  // savoir : rien ne le lui disait.
  const aujourdhui = new Date().toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const message = [
    `DATE DU JOUR : ${aujourdhui}`,
    "",
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
    // Une lettre de quatre paragraphes et un email, en JSON avec ses
    // échappements, dépassent largement 3000 jetons : la réponse était coupée
    // en plein milieu et le JSON illisible. Le premier essai a coûté deux
    // appels facturés pour rien.
    maxTokens: 8000,
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
    brut = JSON.parse(extraireJson(reponse.texte));
    if (!brut.lettre?.paragraphes?.length) throw new Error("format");
  } catch {
    // Le début de la réponse brute est remonté : sans lui, il faut aller
    // fouiller les journaux pour comprendre, comme cela s'est produit.
    throw new ErreurIA(
      "La réponse du modèle n'était pas exploitable. Début reçu : " +
        reponse.texte.trim().slice(0, 200)
    );
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
    // Sans nom d'entreprise, on adresse le service plutôt que la ville : une
    // lettre dont l'en-tête ne portait que « Troyes » ne ressemblait à rien.
    destinataire: [
      offre.entreprise?.trim() || "Service recrutement",
      offre.contact_nom ?? "",
      offre.contact_adresse ?? "",
      ville,
    ].filter(Boolean),
    // Fuseau explicite : le serveur travaille en UTC, et une lettre rédigée
    // après minuit affichait la veille.
    lieuDate: `${villeExpediteur || "France"}, le ${new Date().toLocaleDateString(
      "fr-FR",
      {
        timeZone: "Europe/Paris",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
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

const SYSTEME_EMAIL = `Tu rédiges l'email qui accompagne une candidature déjà rédigée.

Cinq à huit lignes, sobres. Il annonce la candidature et les pièces jointes, donne une raison de lire la lettre, sans la répéter ni la résumer. Aucun fait qui ne soit dans la lettre fournie.

Registre professionnel français, vouvoiement, pas de "n'hésitez pas", pas de superlatif.

Tu réponds UNIQUEMENT par un objet JSON :
{"objet": "...", "corps": "..."}`;

/**
 * Réécrit le seul email, sans retoucher la lettre.
 *
 * Souvent la lettre convient et l'email tombe à côté. Tout régénérer coûterait
 * un appel complet et ferait perdre une lettre validée.
 */
export async function regenererEmailPourOffre(offreId: string): Promise<void> {
  const supabase = creerClientServeur();

  const { data: offreBrute } = await supabase
    .from("offres")
    .select("volet, intitule, entreprise")
    .eq("id", offreId)
    .maybeSingle();
  if (!offreBrute) throw new ErreurCV("Offre introuvable.");
  const offre = offreBrute as {
    volet: CodeVolet;
    intitule: string | null;
    entreprise: string | null;
  };

  const { data: lettreBrute } = await supabase
    .from("documents")
    .select("contenu_texte, version")
    .eq("offre_id", offreId)
    .eq("type", "lettre")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lettre = lettreBrute as { contenu_texte: string; version: number } | null;
  if (!lettre) {
    throw new ErreurCV("Rédige d'abord la lettre : l'email s'appuie dessus.");
  }

  const reponse = await appelIA({
    modele: MODELE_REDACTION,
    systeme: SYSTEME_EMAIL,
    message: [
      `POSTE : ${offre.intitule ?? ""} chez ${offre.entreprise ?? "l'entreprise"}`,
      "",
      "LETTRE JOINTE :",
      lettre.contenu_texte,
    ].join("\n"),
    maxTokens: 1200,
    tache: "email_candidature",
    offreId,
  });

  let email: { objet: string; corps: string };
  try {
    email = JSON.parse(extraireJson(reponse.texte));
    if (!email.corps) throw new Error("format");
  } catch {
    throw new ErreurIA(
      "La réponse du modèle n'était pas exploitable. Début reçu : " +
        reponse.texte.trim().slice(0, 200)
    );
  }

  const { data: derniere } = await supabase
    .from("documents")
    .select("version")
    .eq("offre_id", offreId)
    .eq("type", "email")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("documents").insert({
    offre_id: offreId,
    type: "email",
    volet: offre.volet,
    version: ((derniere as { version: number } | null)?.version ?? 0) + 1,
    contenu_texte: `${email.objet}\n\n${email.corps}`,
    selection: { email },
    cout_usd: reponse.coutUsd,
  });
}
