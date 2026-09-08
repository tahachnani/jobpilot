import React from "react";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { MESURES } from "@/lib/cv/mise-en-page";
import type { ModeleCV } from "@/lib/cv/modele";

/**
 * Mise en page unique du CV, optimisée pour la lecture machine.
 *
 * Une seule colonne du haut en bas : un analyseur de CV lit un PDF en flux et
 * entrelace les lignes des colonnes, ce qui transforme deux listes côte à côte
 * en bouillie. Helvetica, police standard des PDF : elle est embarquée sans
 * téléchargement réseau et son texte reste extractible. Aucun tableau, aucune
 * icône, aucun en-tête ni pied de page.
 */

/**
 * React-PDF coupe les mots en fin de ligne par défaut. En français cela
 * produit des césures fautives, et surtout cela casse les mots-clés que
 * l'analyseur cherche à reconnaître.
 */
Font.registerHyphenationCallback((mot) => [mot]);

const ENCRE = "#111318";
const ENCRE_DOUCE = "#3c4250";
const FILET = "#9aa1ad";

const styles = StyleSheet.create({
  page: {
    paddingVertical: MESURES.margeVerticale,
    paddingHorizontal: MESURES.margeHorizontale,
    fontFamily: "Helvetica",
    fontSize: MESURES.tailleCorps,
    color: ENCRE,
    lineHeight: MESURES.interligne,
  },

  nom: {
    fontFamily: "Helvetica-Bold",
    fontSize: MESURES.tailleNom,
    textAlign: "center",
    letterSpacing: 1.2,
    marginBottom: MESURES.margeApresNom,
  },
  titreCv: {
    fontSize: MESURES.tailleTitre,
    textAlign: "center",
    letterSpacing: 0.8,
    color: ENCRE_DOUCE,
    marginBottom: MESURES.margeApresTitre,
  },
  contact: {
    fontSize: MESURES.tailleContact,
    textAlign: "center",
    color: ENCRE_DOUCE,
    marginBottom: MESURES.margeApresEntete,
  },

  section: { marginTop: MESURES.margeAvantSection },
  titreSection: {
    fontFamily: "Helvetica-Bold",
    fontSize: MESURES.tailleSection,
    letterSpacing: 0.6,
    borderBottomWidth: 0.5,
    borderBottomColor: FILET,
    paddingBottom: MESURES.paddingTitreSection,
    marginBottom: MESURES.margeApresTitreSection,
  },

  accroche: { lineHeight: MESURES.interligneAccroche, textAlign: "justify" },

  experience: { marginTop: MESURES.margeAvantExperience },
  ligneEntete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  poste: { fontFamily: "Helvetica-Bold", flexGrow: 1, flexShrink: 1, paddingRight: 8 },
  dates: { flexShrink: 0, color: ENCRE_DOUCE },
  employeur: {
    color: ENCRE_DOUCE,
    marginBottom: MESURES.margeApresEnteteExperience,
  },

  puce: { flexDirection: "row", marginBottom: MESURES.margeApresPuce },
  marqueur: { width: MESURES.largeurPuce },
  textePuce: { flexGrow: 1, flexShrink: 1 },

  formation: { marginTop: MESURES.margeAvantFormation },
  ligne: { marginBottom: MESURES.margeApresLigne },
});

function Section({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.titreSection}>{titre}</Text>
      {children}
    </View>
  );
}

function Puce({ texte }: { texte: string }) {
  return (
    <View style={styles.puce}>
      <Text style={styles.marqueur}>•</Text>
      <Text style={styles.textePuce}>{texte}</Text>
    </View>
  );
}

export function DocumentCV({ modele }: { modele: ModeleCV }) {
  return (
    <Document
      title={`CV ${modele.nomComplet} — ${modele.titre}`}
      author={modele.nomComplet}
      creator="JobPilot"
      producer="JobPilot"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.nom}>{modele.nomComplet}</Text>
        <Text style={styles.titreCv}>{modele.titre}</Text>
        <Text style={styles.contact}>{modele.contact}</Text>

        {modele.accroche && (
          <Section titre="PROFIL">
            <Text style={styles.accroche}>{modele.accroche}</Text>
          </Section>
        )}

        <Section titre="EXPÉRIENCES PROFESSIONNELLES">
          {modele.experiences.map((e, i) => (
            <View key={i} style={styles.experience} wrap={false}>
              <View style={styles.ligneEntete}>
                <Text style={styles.poste}>{e.poste}</Text>
                <Text style={styles.dates}>
                  {e.periode} · {e.contrat}
                </Text>
              </View>
              <Text style={styles.employeur}>{e.employeur}</Text>
              {e.missions.map((m, j) => (
                <Puce key={j} texte={m.texte} />
              ))}
            </View>
          ))}
        </Section>

        <Section titre="FORMATIONS">
          {modele.formations.map((f, i) => (
            <View key={i} style={styles.formation} wrap={false}>
              <View style={styles.ligneEntete}>
                <Text style={styles.poste}>{f.diplome}</Text>
                <Text style={styles.dates}>{f.periode}</Text>
              </View>
              {f.etablissement ? (
                <Text style={styles.employeur}>{f.etablissement}</Text>
              ) : null}
            </View>
          ))}
        </Section>

        <Section titre="COMPÉTENCES">
          {modele.competences.map((c, i) => (
            <Puce key={i} texte={c} />
          ))}
        </Section>

        {/* Une ligne continue, pas deux colonnes : rien à entrelacer pour un
            analyseur, et trois puces de quatre mots gaspillaient la page. */}
        <Section titre="LANGUES">
          <Text style={styles.ligne}>{modele.langues.join("   |   ")}</Text>
        </Section>

        {modele.interets && (
          <Section titre="CENTRES D'INTÉRÊT">
            <Text style={styles.ligne}>{modele.interets}</Text>
          </Section>
        )}
      </Page>
    </Document>
  );
}
