import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactPrincipal,
  contactsDansAnnonce,
} from "@/lib/offre/contact";

/**
 * D94 — l'adresse de candidature, trouvée sans modèle.
 *
 * Les six cas ci-dessous sont les six situations réellement rencontrées dans
 * la base au 29 septembre. Deux adresses de candidature, quatre pièges.
 */

test("l'adresse de candidature est trouvée, avec son destinataire", () => {
  const annonce =
    "Comment postuler ? Un simple mail avec un CV à Jonathan THIRIONET, " +
    "Responsable Recrutement : j.thirionet@auditionconseil.com. Pas besoin de " +
    "lettre de motivation !";

  const c = contactPrincipal(annonce);
  assert.equal(c?.email, "j.thirionet@auditionconseil.com");
  assert.equal(c?.nom, "Jonathan THIRIONET");
  assert.match(c!.phrase, /Responsable Recrutement/);
});

test("une adresse de service désignée pour candidater est retenue", () => {
  const c = contactPrincipal(
    "Envoyez nous votre CV ainsi que quelques mots sur votre motivation à " +
      "l'adresse suivante : direction@boulangeriemillet.com"
  );
  assert.equal(c?.email, "direction@boulangeriemillet.com");
  // Aucun nom dans la phrase : on n'en invente pas.
  assert.equal(c?.nom, null);
});

test("la mention RGPD est écartée", () => {
  const c = contactPrincipal(
    "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification " +
      "et de suppression de vos données. Vous pouvez exercer ces droits auprès " +
      "de dpo@septeo.com."
  );
  assert.equal(c, null);
});

test("le référent Mission Handicap est écarté", () => {
  const c = contactPrincipal(
    "Nous adaptons notre processus de recrutement. Pour un accompagnement " +
      "personnalisé lors de votre candidature, contactez notre référent " +
      "Mission Handicap : diversite.fr@siemens.com"
  );
  assert.equal(c, null);
});

test("le placeholder d'un formulaire est écarté", () => {
  const c = contactPrincipal(
    "Identifiant (email, de type exemple@exemple.fr) Mot de passe"
  );
  assert.equal(c, null);
});

test("l'adresse d'une plateforme n'est jamais celle du recruteur", () => {
  const c = contactPrincipal(
    "Pour postuler, répondez à r-c-6ab9@reply.hellowork.com avec votre CV."
  );
  assert.equal(c, null);
});

test("une annonce sans adresse ne rend rien", () => {
  assert.deepEqual(contactsDansAnnonce("Postulez via le formulaire en ligne."), []);
  assert.deepEqual(contactsDansAnnonce(null), []);
});

test("l'adresse de candidature passe devant une adresse quelconque", () => {
  const annonce =
    "Notre siège : info@societe.fr pour toute question commerciale. " +
    "Merci d'adresser votre candidature et votre CV à recrutement@societe.fr.";

  const trouves = contactsDansAnnonce(annonce);
  assert.equal(trouves[0].email, "recrutement@societe.fr");
  assert.equal(trouves.length, 2);
});

test("les entités HTML sont décodées dans la phrase affichée", () => {
  const c = contactPrincipal(
    "Envoyez votre candidature &#xE0; l&#x27;adresse : rh@societe.fr"
  );
  assert.ok(c);
  assert.ok(!c!.phrase.includes("&#x"), c!.phrase);
  assert.match(c!.phrase, /l'adresse/);
});

test("la ponctuation finale ne colle pas à l'adresse", () => {
  const c = contactPrincipal("Candidature et CV à rh@societe.fr.");
  assert.equal(c?.email, "rh@societe.fr");
});
