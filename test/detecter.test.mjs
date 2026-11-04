// Seuils et dédoublonnage des séismes (src/detecter.mjs), sur un flux USGS simulé : aucun appel réseau.
// Lancer : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { detecter, reseaux } from "../src/detecter.mjs";

const MAINTENANT = Date.parse("2026-11-04T12:00:00Z");
const min = 60e3;
// Un séisme du flux : âge en minutes, réseau « us » et magnitude de moment par défaut
const q = ({ id = "us1", mag, place = "100 km S of Somewhere, Chile", age = 40, net = "us", magType = "mww", ids, lonlat = [-70, -20], alert = null }) => ({
  id, geometry: { coordinates: [...lonlat, 10] },
  properties: { mag, place, time: MAINTENANT - age * min, net, magType, ids: ids ?? `,${id},`, alert },
});
// Le flux simulé que detecter() lira à la place de l'USGS
const avecFlux = async (features, etat = {}) => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ features }) });
  try { return await detecter(etat, MAINTENANT); } finally { globalThis.fetch = original; }
};

test("seuils par zone et par réseau", () => {
  const r = (mag, place, alert) => reseaux(q({ mag, place, alert }));
  assert.deepEqual(r(3.9, "10 km N of Ridgecrest, CA"), []);
  assert.deepEqual(r(4.0, "10 km N of Ridgecrest, CA"), ["x"]);
  assert.deepEqual(r(4.5, "62 km SSE of Sand Point, Alaska"), ["x", "instagram", "facebook"]);
  assert.deepEqual(r(4.4, "Izu Islands, Japan region"), []);
  assert.deepEqual(r(4.5, "Izu Islands, Japan region"), ["x"]);
  assert.deepEqual(r(5.0, "Izu Islands, Japan region"), ["x", "instagram", "facebook"]);
  assert.deepEqual(r(4.9, "south of the Fiji Islands"), []);
  assert.deepEqual(r(5.4, "south of the Fiji Islands"), ["x"]);
  assert.deepEqual(r(5.5, "south of the Fiji Islands"), ["x", "instagram", "facebook"]);
  assert.deepEqual(r(6.0, "south of the Fiji Islands"), ["x", "instagram", "facebook", "reel"]);
  // Alerte PAGER orange : un reel même sous le seuil de magnitude
  assert.deepEqual(r(5.2, "50 km W of Arica, Chile", "orange"), ["x", "reel"]);
});

test("seuils sur la magnitude affichée (arrondie au dixième)", () => {
  // ml 4,96 affiché « M5.0 » : traité comme M5,0 ; 5,95 affiché « M6.0 » : reel
  assert.deepEqual(reseaux(q({ mag: 4.96 })), ["x"]);
  assert.ok(reseaux(q({ mag: 5.95 })).includes("reel"));
  assert.deepEqual(reseaux(q({ mag: 4.94 })), []);
});

test("attente avant de publier : 20 min minimum, 6 h maximum", async () => {
  assert.equal((await avecFlux([q({ mag: 5.2, age: 15 })])).length, 0);
  assert.equal((await avecFlux([q({ mag: 5.2, age: 25 })])).length, 1);
  assert.equal((await avecFlux([q({ mag: 5.2, age: 7 * 60 })])).length, 0);
});

test("magnitude rapide à partir de M5,5 : on attend la magnitude de moment, 30 min au plus", async () => {
  assert.equal((await avecFlux([q({ mag: 5.7, magType: "mb", age: 25 })])).length, 0);
  assert.equal((await avecFlux([q({ mag: 5.7, magType: "mb", age: 35 })])).length, 1);
  assert.equal((await avecFlux([q({ mag: 5.7, magType: "mww", age: 25 })])).length, 1);
  // Sous M5,5, une magnitude rapide suffit
  assert.equal((await avecFlux([q({ mag: 5.2, magType: "mb", age: 25 })])).length, 1);
});

test("réseau régional américain : on attend la solution USGS, 30 min au plus", async () => {
  const ak = (age) => q({ id: "ak1", mag: 4.8, place: "80 km S of False Pass, Alaska", net: "ak", magType: "ml", age });
  assert.equal((await avecFlux([ak(25)])).length, 0);
  assert.equal((await avecFlux([ak(35)])).length, 1);
});

test("même séisme vu par deux réseaux (False Pass, 29/10/2026) : un seul post, celui de l'USGS", async () => {
  const place = "80 km S of False Pass, Alaska";
  const ak = q({ id: "ak1", mag: 4.8, place, net: "ak", magType: "ml", age: 40, lonlat: [-163.4, 54.1] });
  const us = q({ id: "us1", mag: 5.0, place, age: 40.2, lonlat: [-163.5, 54.2] });
  const r = await avecFlux([ak, us]);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "us1");
  // Déjà publié sous l'id du réseau régional : rien de plus
  assert.equal((await avecFlux([ak, us], { ak1: { x: "fait", instagram: "fait", facebook: "fait" } })).length, 0);
});

test("id changé après fusion (ids) : les réseaux déjà faits ne repartent pas", async () => {
  const us = q({ id: "us2", mag: 5.0, place: "80 km S of False Pass, Alaska", ids: ",ak2,us2," });
  assert.equal((await avecFlux([us], { ak2: { x: "fait", instagram: "fait", facebook: "fait" } })).length, 0);
  // Seul X était fait : il reste Instagram et Facebook
  assert.deepEqual((await avecFlux([us], { ak2: { x: "fait" } }))[0].reseaux, ["instagram", "facebook"]);
});

test("deux séismes distincts : deux posts, du plus ancien au plus récent", async () => {
  const r = await avecFlux([
    q({ id: "us3", mag: 5.1, age: 30, lonlat: [140, 35] }),
    q({ id: "us4", mag: 5.3, age: 50, lonlat: [-70, -20] }),
  ]);
  assert.deepEqual(r.map((e) => e.id), ["us4", "us3"]);
});
