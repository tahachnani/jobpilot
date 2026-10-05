/**
 * Le périmètre géographique (D122).
 *
 * Versionné dans Git comme les secteurs et les volets (D11) : il change
 * rarement, il se relit, il se révoque.
 *
 * Deux usages, une seule liste. Le barème s'en sert pour noter la distance —
 * quarante-quatre offres sur quatre-vingt-dix-neuf étaient hors Île-de-France
 * et rien ne le disait avant d'avoir payé l'analyse. Le CV s'en sert pour la
 * mention de mobilité sur la ligne de contact.
 *
 * Ce que cette liste ne fait pas : écrire sur le CV une ville où Taha n'habite
 * pas. Un recruteur lyonnais qui lit « Lyon » puis découvre un parcours
 * entièrement au Mans et à Fès, et un profil LinkedIn francilien cité sur la
 * même ligne de contact, ne conclut pas qu'il est du coin. La mention dit donc
 * la mobilité, qui est vraie et qui répond à la seule question que le
 * recruteur se pose : est-ce qu'il viendra.
 */

/** Départements d'Île-de-France : le domicile, trajet quotidien possible. */
export const DEPARTEMENTS_IDF = [
  "75",
  "77",
  "78",
  "91",
  "92",
  "93",
  "94",
  "95",
];

export interface VilleMobilite {
  ville: string;
  /** Le département entier compte : on vise l'agglomération, pas la commune. */
  departement: string;
}

/**
 * Les villes où une installation est envisagée.
 *
 * Le Mans y figure sans être une métropole : l'alternance, le CDD et le master
 * s'y sont faits, et une candidature là-bas se défend d'elle-même.
 */
export const VILLES_MOBILITE: VilleMobilite[] = [
  { ville: "Lyon", departement: "69" },
  { ville: "Marseille", departement: "13" },
  { ville: "Aix-en-Provence", departement: "13" },
  { ville: "Bordeaux", departement: "33" },
  { ville: "Toulouse", departement: "31" },
  { ville: "Nantes", departement: "44" },
  { ville: "Rennes", departement: "35" },
  { ville: "Lille", departement: "59" },
  { ville: "Strasbourg", departement: "67" },
  { ville: "Montpellier", departement: "34" },
  { ville: "Nice", departement: "06" },
  { ville: "Le Mans", departement: "72" },
];

export type CodeZone = "domicile" | "mobilite" | "hors" | "inconnue";

export interface Zone {
  zone: CodeZone;
  /** La ville de mobilité reconnue, quand il y en a une. */
  ville: string | null;
}

/** Minuscules sans accents, pour comparer « Aix-en-Provence » et « AIX EN PROVENCE ». */
function aplatir(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Où tombe une offre.
 *
 * Le nom de la ville l'emporte sur le département : « Corbas (Lyon) » est
 * lyonnais sans ambiguïté. Le département ne sert qu'ensuite, et il vise
 * l'agglomération — Tourcoing et Halluin relèvent de Lille, Vénissieux et
 * Limonest de Lyon. C'est un signal, pas un calcul d'itinéraire : la mention
 * nomme la ville retenue pour que l'erreur se voie.
 */
export function zoneDeLOffre(
  localisation: string | null,
  departement: string | null
): Zone {
  /**
   * Un département absent doit rester absent.
   *
   * `"".padStart(2, "0")` rend `"00"` — un code de département qui n'existe
   * pas mais qui est bien une chaîne non vide. Sans ce garde, « Siège social »
   * et les onze offres sans localisation tombaient « hors périmètre » au lieu
   * d'être écartées du calcul, et se voyaient coller 40 sur un critère qu'on
   * n'avait pas mesuré.
   */
  const brut = (departement ?? "").trim();
  const dept = brut ? brut.padStart(2, "0").slice(0, 3) : "";
  const texte = aplatir(localisation ?? "");

  if (!texte && !dept) return { zone: "inconnue", ville: null };

  // L'Île-de-France d'abord : elle l'emporte sur tout le reste, et une offre
  // francilienne n'a aucune mention à porter.
  if (DEPARTEMENTS_IDF.includes(dept)) return { zone: "domicile", ville: null };
  if (/\bile de france\b/.test(texte)) return { zone: "domicile", ville: null };

  const parVille = VILLES_MOBILITE.find((v) =>
    new RegExp(`\\b${aplatir(v.ville)}\\b`).test(texte)
  );
  if (parVille) return { zone: "mobilite", ville: parVille.ville };

  const parDepartement = dept
    ? VILLES_MOBILITE.find((v) => v.departement === dept)
    : undefined;
  if (parDepartement) return { zone: "mobilite", ville: parDepartement.ville };

  /**
   * Sans département, on ne conclut pas à « hors périmètre ».
   *
   * Les annonces écrivent « Siège social », « Halluin », « Salins-Fontaine » —
   * un lieu que l'extraction n'a pas su rattacher. Les ranger d'office hors
   * périmètre leur collerait 40 sur un critère qu'on n'a pas mesuré. Le barème
   * sait écarter un critère non mesurable (D66) ; c'est ce qu'il faut ici.
   */
  if (!dept) return { zone: "inconnue", ville: null };

  return { zone: "hors", ville: null };
}

/**
 * Note de lieu, sur le modèle de `noteSecteur` : le code calcule, et il dit
 * pourquoi.
 *
 * Hors périmètre vaut 40 et non zéro. Une offre lointaine reste candidatable —
 * une bonne offre à Caen mérite d'être vue — mais elle ne doit pas passer pour
 * équivalente à la même offre à La Défense.
 */
export function noteLieu(zone: Zone): {
  note: number;
  explication: string;
  mesurable: boolean;
} {
  switch (zone.zone) {
    case "domicile":
      return {
        note: 100,
        explication: "Île-de-France : trajet quotidien depuis Saint-Denis.",
        mesurable: true,
      };
    case "mobilite":
      return {
        note: 85,
        explication: `${zone.ville} fait partie des villes où tu es mobile — une installation, pas un trajet.`,
        mesurable: true,
      };
    case "hors":
      return {
        note: 40,
        explication:
          "Hors Île-de-France et hors de tes villes de mobilité : un déménagement non prévu.",
        mesurable: true,
      };
    default:
      return {
        note: 0,
        explication:
          "Lieu non identifiable dans l'annonce : critère écarté du calcul.",
        mesurable: false,
      };
  }
}

/**
 * La mention de mobilité à accoler à la localisation sur le CV.
 *
 * Vide en Île-de-France : Taha est sur place, et l'écrire affaiblirait la
 * ligne. Vide aussi hors périmètre : promettre une installation qu'on n'a pas
 * décidée se paie au premier entretien.
 */
export function mentionMobilite(zone: Zone): string | null {
  return zone.zone === "mobilite" && zone.ville
    ? `mobile ${zone.ville}`
    : null;
}
