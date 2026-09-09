import React from "react";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { MESURES } from "@/lib/cv/mise-en-page";

/**
 * Mise en page de la lettre.
 *
 * Mêmes marges, même police et même encre que le CV : les deux pièces
 * arrivent ensemble et doivent se ressembler. Le corps est un peu plus grand
 * qu'un CV — une lettre se lit, elle ne se parcourt pas.
 */

Font.registerHyphenationCallback((mot) => [mot]);

const ENCRE = "#111318";
const ENCRE_DOUCE = "#3c4250";

const TAILLE = 10;
const INTERLIGNE = 1.45;

export interface ModeleLettre {
  expediteur: string[];
  destinataire: string[];
  lieuDate: string;
  objet: string;
  formuleAppel: string;
  paragraphes: string[];
  formulePolitesse: string;
  signature: string;
  meta: { volet: string; genereLe: string };
}

const styles = StyleSheet.create({
  page: {
    paddingVertical: MESURES.margeVerticale + 12,
    paddingHorizontal: MESURES.margeHorizontale + 12,
    fontFamily: "Helvetica",
    fontSize: TAILLE,
    lineHeight: INTERLIGNE,
    color: ENCRE,
  },
  entetes: { flexDirection: "row", justifyContent: "space-between" },
  colonne: { width: "45%" },
  ligne: { lineHeight: 1.3 },
  nom: { fontFamily: "Helvetica-Bold", lineHeight: 1.3 },
  lieuDate: { marginTop: 28, textAlign: "right" },
  objet: { marginTop: 28, fontFamily: "Helvetica-Bold" },
  appel: { marginTop: 22 },
  paragraphe: { marginTop: 12, textAlign: "justify" },
  politesse: { marginTop: 18, textAlign: "justify" },
  signature: { marginTop: 26, textAlign: "right", color: ENCRE_DOUCE },
});

export function DocumentLettre({ modele }: { modele: ModeleLettre }) {
  return (
    <Document
      title={`Lettre de motivation — ${modele.objet}`}
      author={modele.signature}
      creator="JobPilot"
      producer="JobPilot"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.entetes}>
          <View style={styles.colonne}>
            {modele.expediteur.map((l, i) => (
              <Text key={i} style={i === 0 ? styles.nom : styles.ligne}>
                {l}
              </Text>
            ))}
          </View>
          <View style={styles.colonne}>
            {modele.destinataire.map((l, i) => (
              <Text key={i} style={i === 0 ? styles.nom : styles.ligne}>
                {l}
              </Text>
            ))}
          </View>
        </View>

        <Text style={styles.lieuDate}>{modele.lieuDate}</Text>
        <Text style={styles.objet}>{modele.objet}</Text>
        <Text style={styles.appel}>{modele.formuleAppel}</Text>

        {modele.paragraphes.map((p, i) => (
          <Text key={i} style={styles.paragraphe}>
            {p}
          </Text>
        ))}

        <Text style={styles.politesse}>{modele.formulePolitesse}</Text>
        <Text style={styles.signature}>{modele.signature}</Text>
      </Page>
    </Document>
  );
}

export async function rendreLettre(modele: ModeleLettre): Promise<Buffer> {
  return renderToBuffer(<DocumentLettre modele={modele} />);
}

/** Version texte, pour le stockage et le contrôle d'ancrage. */
export function lettreEnTexte(m: ModeleLettre): string {
  return [
    ...m.expediteur,
    "",
    ...m.destinataire,
    "",
    m.lieuDate,
    "",
    m.objet,
    "",
    m.formuleAppel,
    "",
    ...m.paragraphes,
    "",
    m.formulePolitesse,
    "",
    m.signature,
  ].join("\n");
}
