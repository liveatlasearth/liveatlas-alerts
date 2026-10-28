// Alert engine, run by GitHub Actions (.github/workflows/alertes.yml): every 10 minutes, and right away when the o2switch trigger sees a new event.
// Earthquakes: detect → gather the data → write the texts → render images and reel. Volcanoes: new eruptions and raised alert levels → images.
// Then the workflow publishes (release, Instagram and Facebook, issue) and this script remembers what was done.
// Usage: node src/principal.mjs              normal run
//        node src/principal.mjs <id USGS>    build one earthquake by hand (all networks), whatever the thresholds
//        node src/principal.mjs v<id GVP>    build one volcano by hand (e.g. v282080 for Sakurajima)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ecrireJson, json, RACINE, SEUILS } from "./commun.mjs";
import { detecter } from "./detecter.mjs";
import { donnees } from "./donnees.mjs";
import { textes } from "./textes.mjs";
import { fermer, images, imagesVolcan, reel } from "./rendre.mjs";
import { brouillon } from "./publier.mjs";
import { detecterVolcans, donneesVolcan, lireVolcans, memoriser, niveaux, textesVolcan } from "./volcans.mjs";

const ETAT = join(RACINE, "etat", "publies.json"), ETAT_V = join(RACINE, "etat", "volcans.json"), SORTIE = join(RACINE, "sortie");
const lire = (f) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return {}; } };
const etat = lire(ETAT), etatV = lire(ETAT_V), maintenant = Date.now(), aujourdhui = new Date().toISOString().slice(0, 10);
mkdirSync(SORTIE, { recursive: true });
const manuel = process.argv[2];
const resume = [];

// ---------- Earthquakes ----------
let liste = [];
if (manuel && !manuel.startsWith("v")) {
  const q = await json(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${manuel}.geojson`);
  liste = [{ id: manuel, mag: q.properties.mag, lieu: q.properties.place, temps: q.properties.time, reseaux: ["x", "instagram", "facebook", "reel"] }];
} else if (!manuel) {
  liste = await detecter(etat, maintenant);
  // First run: remember what is already in the feed without posting it (no flood of old quakes)
  if (!etat._init) {
    for (const e of liste) etat[e.id] = Object.fromEntries(e.reseaux.map((r) => [r, `${new Date().toISOString()} init`]));
    etat._init = new Date().toISOString(); ecrireJson(ETAT, etat); liste = [];
    console.log("Séismes : initialisation, rien publié");
  }
}
// Daily caps per network (config/seuils.json)
const plafond = SEUILS.garde_fous.max_posts_par_jour, cle = { x: "x_seismes", instagram: "instagram_seismes", facebook: "facebook_seismes", reel: "instagram_seismes" };
const faitsDuJour = (r) => Object.values(etat).filter((v) => typeof v === "object" && typeof v[r] === "string" && v[r].startsWith(aujourdhui)).length;

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
    else { etat[e.id] = { ...etat[e.id], reel: `${new Date().toISOString()} sans-donnees` }; e.reseaux = e.reseaux.filter((r) => r !== "reel"); }
  }
  if (!e.reseaux.length) continue;
  writeFileSync(join(sortie, "legendes.json"), JSON.stringify(txt, null, 1));
  const statut = brouillon(e, d, txt, fichiers, sortie);
  etat[e.id] = { ...etat[e.id], ...Object.fromEntries(Object.entries(statut).map(([r, s]) => [r, `${new Date().toISOString()} ${s}`])) };
  resume.push({ id: e.id, mag: d.mag, lieu: d.lieu, reseaux: e.reseaux, fichiers });
}

// ---------- Volcanoes ----------
// A failure here (site data briefly unavailable) must never block the earthquake alerts: logged, retried at the next run
if (!manuel || manuel.startsWith("v")) try {
  const volcans = await lireVolcans();
  let listeV;
  if (manuel) {
    const v = volcans.find((x) => `v${x.id}` === manuel);
    if (!v) throw new Error(`Volcan ${manuel} absent des données du site (seuls les volcans en éruption ou en alerte y sont)`);
    // By hand: the current state of the volcano, stated as it is ("Is Erupting", "at Alert Level 3"), never an invented raise
    const n = niveaux(v), cas = v.statut === "eruption" && v.depuis && maintenant - Date.parse(v.depuis) < 60 * 86400e3 ? "eruption"
      : n.jma >= 3 ? "jma" : n.usgs >= 3 ? "usgs" : n.geonet >= 3 ? "geonet" : "etat";
    listeV = [{ id: manuel, volcan: v, cas, reseaux: ["x", "instagram", "facebook"] }];
  } else {
    if (!etatV._init) { memoriser(volcans, etatV); etatV._init = new Date().toISOString(); console.log("Volcans : initialisation, rien publié"); }
    listeV = detecterVolcans(volcans, etatV, maintenant);
  }
  for (const e of listeV.slice(0, 3)) {
    console.log(`\n== ${e.id} ${e.volcan.nom} (${e.cas}) → ${e.reseaux.join(", ")}`);
    const d = await donneesVolcan(e.volcan, e.cas, !!manuel), txt = textesVolcan(d), sortie = join(SORTIE, e.id);
    mkdirSync(sortie, { recursive: true });
    const fichiers = await imagesVolcan(d, txt.ecran, sortie);
    writeFileSync(join(sortie, "legendes.json"), JSON.stringify(txt, null, 1));
    brouillon(e, d, txt, fichiers, sortie);
    resume.push({ id: e.id, nom: d.nom, cas: e.cas, reseaux: e.reseaux, fichiers });
  }
  if (!manuel) { memoriser(volcans, etatV); ecrireJson(ETAT_V, etatV); }
} catch (e) { if (manuel) throw e; console.log("Volcans : données indisponibles, on réessaie au prochain passage :", e.message); }

fermer();
if (!manuel) {
  // Keep two weeks of earthquake memory
  for (const [id, v] of Object.entries(etat)) if (id !== "_init" && typeof v === "object" && Object.values(v).every((s) => typeof s === "string" && s.slice(0, 10) < new Date(maintenant - 14 * 86400e3).toISOString().slice(0, 10))) delete etat[id];
  ecrireJson(ETAT, etat);
}
ecrireJson(join(SORTIE, "alertes.json"), resume);
console.log("\nTerminé :", resume.length, "alerte(s)");
