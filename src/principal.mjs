// Alert engine, run every 10 minutes by GitHub Actions (.github/workflows/alertes.yml).
// Detect → gather the data → write the texts → render images and reel → publish (draft mode for now) → remember what was done.
// Usage: node src/principal.mjs            normal run
//        node src/principal.mjs <id USGS>  build one event by hand (all networks), whatever the thresholds
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ecrireJson, json, RACINE, SEUILS } from "./commun.mjs";
import { detecter, reseaux } from "./detecter.mjs";
import { donnees } from "./donnees.mjs";
import { textes } from "./textes.mjs";
import { fermer, images, reel } from "./rendre.mjs";
import { brouillon } from "./publier.mjs";

const ETAT = join(RACINE, "etat", "publies.json"), SORTIE = join(RACINE, "sortie");
const etat = JSON.parse(readFileSync(ETAT, "utf8")), maintenant = Date.now(), aujourdhui = new Date().toISOString().slice(0, 10);
mkdirSync(SORTIE, { recursive: true });
const manuel = process.argv[2];

let liste;
if (manuel) {
  const q = await json(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${manuel}.geojson`);
  liste = [{ id: manuel, mag: q.properties.mag, lieu: q.properties.place, temps: q.properties.time, reseaux: ["x", "instagram", "facebook", "reel"] }];
} else {
  liste = await detecter(etat, maintenant);
  // First run: remember what is already in the feed without posting it (no flood of old quakes)
  if (!etat._init) {
    for (const e of liste) etat[e.id] = Object.fromEntries(e.reseaux.map((r) => [r, `${new Date().toISOString()} init`]));
    etat._init = new Date().toISOString(); ecrireJson(ETAT, etat);
    console.log("Initialisation :", liste.length, "séismes mémorisés sans publication"); process.exit(0);
  }
}

// Daily caps per network (config/seuils.json)
const plafond = SEUILS.garde_fous.max_posts_par_jour, cle = { x: "x_seismes", instagram: "instagram_seismes", facebook: "facebook_seismes", reel: "instagram_seismes" };
const faitsDuJour = (r) => Object.values(etat).filter((v) => typeof v === "object" && typeof v[r] === "string" && v[r].startsWith(aujourdhui)).length;

const resume = [];
for (const e of liste.slice(0, 4)) {
  e.reseaux = e.reseaux.filter((r) => manuel || faitsDuJour(r) < (plafond[cle[r]] ?? 99));
  if (!e.reseaux.length) continue;
  console.log(`\n== ${e.id} M${e.mag} ${e.lieu} → ${e.reseaux.join(", ")}`);
  const d = await donnees(e.id), txt = textes(d), sortie = join(SORTIE, e.id), fichiers = [];
  mkdirSync(sortie, { recursive: true });
  if (e.reseaux.some((r) => r !== "reel")) fichiers.push(...await images(d, txt.ecran, sortie));
  if (e.reseaux.includes("reel")) {
    if (d.pager && d.shakemap && d.villes.length) fichiers.push(...await reel(d, txt.ecran, txt.narration, sortie));
    else if (maintenant - d.temps < 3 * 3600e3 && !manuel) { e.reseaux = e.reseaux.filter((r) => r !== "reel"); console.log("reel : ShakeMap ou PAGER pas encore publiés, on réessaie au prochain passage"); }
    else { etat[e.id] = { ...etat[e.id], reel: "sans-donnees" }; e.reseaux = e.reseaux.filter((r) => r !== "reel"); }
  }
  if (!e.reseaux.length) continue;
  writeFileSync(join(sortie, "legendes.json"), JSON.stringify(txt, null, 1));
  const statut = brouillon(e, d, txt, fichiers, sortie);
  etat[e.id] = { ...etat[e.id], ...Object.fromEntries(Object.entries(statut).map(([r, s]) => [r, `${new Date().toISOString()} ${s}`])) };
  resume.push({ id: e.id, mag: d.mag, lieu: d.lieu, reseaux: e.reseaux, fichiers });
}
fermer();
if (!manuel) {
  // Keep two weeks of memory
  for (const [id, v] of Object.entries(etat)) if (id !== "_init" && typeof v === "object" && Object.values(v).every((s) => typeof s === "string" && s.slice(0, 10) < new Date(maintenant - 14 * 86400e3).toISOString().slice(0, 10))) delete etat[id];
  ecrireJson(ETAT, etat);
}
ecrireJson(join(SORTIE, "alertes.json"), resume);
console.log("\nTerminé :", resume.length, "alerte(s)");
