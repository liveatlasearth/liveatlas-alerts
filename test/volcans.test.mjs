// Hausses de niveau et nouvelles éruptions (src/volcans.mjs), sans réseau.
// Lancer : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { detecterVolcans, memoriser, niveaux } from "../src/volcans.mjs";

const MAINTENANT = Date.parse("2026-11-04T12:00:00Z");
const jma = (code) => ({ organisme: "JMA", code });
const volcan = (alertes, statut = "alerte", depuis = null) => ({ id: 282080, nom: "Sakurajima", statut, depuis, alertes });

test("niveaux : une agence absente ne donne pas 0", () => {
  assert.deepEqual(niveaux(volcan([jma(13)])), { jma: 3 });
  assert.deepEqual(niveaux(volcan([])), {});
  // Codes JMA d'avertissement (22, 36…) : pas un niveau
  assert.deepEqual(niveaux(volcan([jma(22)])), {});
  assert.deepEqual(niveaux(volcan([{ organisme: "USGS", couleur: "ORANGE" }])), { usgs: 3 });
});

test("hausse JMA au niveau 3 : publiée ; niveau inchangé : rien", () => {
  assert.deepEqual(detecterVolcans([volcan([jma(13)])], { 282080: { eruption: false, jma: 2 } }, MAINTENANT).map((e) => e.cas), ["jma"]);
  assert.equal(detecterVolcans([volcan([jma(13)])], { 282080: { eruption: false, jma: 3 } }, MAINTENANT).length, 0);
  // Hausse sous le seuil (1 → 2) : rien
  assert.equal(detecterVolcans([volcan([jma(12)])], { 282080: { eruption: false, jma: 1 } }, MAINTENANT).length, 0);
});

test("volcan jamais vu : mémorisé, jamais publié (pas de rafale au démarrage)", () => {
  assert.equal(detecterVolcans([volcan([jma(14)])], {}, MAINTENANT).length, 0);
});

test("agence absente un passage puis revenue : pas de fausse hausse", () => {
  const etat = { 282080: { eruption: false, jma: 3 } };
  memoriser([volcan([])], etat);
  assert.equal(etat[282080].jma, 3);
  assert.equal(detecterVolcans([volcan([jma(13)])], etat, MAINTENANT).length, 0);
});

test("nouvelle éruption : publiée si elle a commencé il y a moins de 60 jours", () => {
  const avant = { 282080: { eruption: false } };
  assert.deepEqual(detecterVolcans([volcan([], "eruption", "2026-10-20")], avant, MAINTENANT).map((e) => e.cas), ["eruption"]);
  assert.equal(detecterVolcans([volcan([], "eruption", "2026-01-10")], avant, MAINTENANT).length, 0);
  // Déjà en éruption au passage précédent : rien
  assert.equal(detecterVolcans([volcan([], "eruption", "2026-10-20")], { 282080: { eruption: true } }, MAINTENANT).length, 0);
});
