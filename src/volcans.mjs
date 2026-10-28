// Volcano alerts for @LiveAtlasErupts, from the public Live Atlas data (www.liveatlas.earth/donnees/evenements.json, refreshed
// every hour from the Smithsonian GVP weekly report, USGS, JMA and GeoNet alert levels) and the public search index (English names and pages).
// Triggers (config/seuils.json): a new eruption, or an alert level raised to USGS orange or red, JMA level 3+, GeoNet level 3+.
// Never a simple VAAC ash advisory.
import { join } from "node:path";
import { COMPTES, ecrireJson, json, lireJson, RACINE, variante } from "./commun.mjs";
import { geoAutour } from "./donnees.mjs";

const SITE = "https://www.liveatlas.earth", HASHTAGS = lireJson("config", "hashtags.json");
const COULEURS = ["GREEN", "YELLOW", "ORANGE", "RED"];
let PAYS_NE = null;
const paysEn = (fr) => { if (!fr) return null; const f = (PAYS_NE ??= lireJson("donnees", "ne_pays_110m.geojson").features).find((x) => x.properties.NAME_FR === fr); return f ? ({ "United States of America": "United States", "Dem. Rep. Congo": "DR Congo" }[f.properties.NAME] ?? f.properties.NAME) : null; };

// Alert levels of one volcano as comparable numbers
export const niveaux = (v) => {
  const n = { usgs: 0, jma: 0, geonet: 0 };
  for (const a of v.alertes ?? []) {
    if (a.organisme === "USGS") n.usgs = COULEURS.indexOf(a.couleur) + 1;
    // JMA: codes 11 to 15 are the numbered levels 1 to 5. Other codes (22 "Danger Around the Crater", 36 "Marine Warning…")
    // are keyword warnings for volcanoes without levels: shown with their own words, never treated as a level
    if (a.organisme === "JMA" && a.code >= 11 && a.code <= 15) n.jma = a.code - 10;
    if (a.organisme === "GeoNet") n.geonet = +a.niveau || 0;
  }
  return n;
};

export async function lireVolcans() { return (await json(`${SITE}/donnees/evenements.json`)).volcans; }

// etat: { <id>: { eruption, usgs, jma, geonet, publie: { x, instagram, facebook } } }
export function detecterVolcans(volcans, etat, maintenant = Date.now()) {
  const aFaire = [];
  for (const v of volcans) {
    const avant = etat[v.id], n = niveaux(v), eruption = v.statut === "eruption";
    if (!avant) continue; // first time seen: remembered below, never posted (no flood at start)
    let cas = null;
    if (eruption && !avant.eruption && v.depuis && maintenant - Date.parse(v.depuis) < 60 * 86400e3) cas = "eruption";
    else if (n.usgs >= 3 && n.usgs > avant.usgs) cas = "usgs";
    else if (n.jma >= 3 && n.jma > avant.jma) cas = "jma";
    else if (n.geonet >= 3 && n.geonet > avant.geonet) cas = "geonet";
    if (cas) aFaire.push({ id: `v${v.id}`, volcan: v, cas, reseaux: ["x", "instagram", "facebook"] });
  }
  return aFaire;
}
export const memoriser = (volcans, etat) => { for (const v of volcans) etat[v.id] = { ...etat[v.id], eruption: v.statut === "eruption", ...niveaux(v) }; };

// Everything needed for the images and captions of one volcano alert
export async function donneesVolcan(v, cas, manuel = false) {
  const index = await json(`${SITE}/donnees/recherche.json`), entree = (Array.isArray(index) ? index : Object.values(index)).find((x) => Array.isArray(x) && x[4] === "v" && x[2] === `/fr/volcans/${v.slug}/`);
  const nom = entree?.[1] ?? v.nom, lien = entree ? SITE + entree[3] : COMPTES.volcans.lien_volcans, pays = paysEn(v.pays);
  const n = niveaux(v), jma = v.alertes?.find((a) => a.organisme === "JMA"), usgs = v.alertes?.find((a) => a.organisme === "USGS"), geonet = v.alertes?.find((a) => a.organisme === "GeoNet");
  const d = { id: `v${v.id}`, gvp: v.id, manuel, nom, pays, lon: v.lon, lat: v.lat, depuis: v.depuis, statut: v.statut, cas, lien, n, jma, usgs, geonet, geo: geoAutour(v.lon, v.lat) };
  ecrireJson(join(RACINE, "public", "evenements", d.id, "donnees.json"), d, false);
  return d;
}

const tag = (s) => "#" + s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
const tagLocal = (s) => "#" + s.replace(/[\s'’.,\-]/g, "");

export function textesVolcan(d) {
  const court = d.nom.replace(/\s*\(.*\)$/, ""), annee = d.depuis ? d.depuis.slice(0, 4) : null;
  // Alert line and pill, from the agency that raised it
  let pastille, alerte, emoji, couleur, sourceJma = false;
  if (d.cas === "eruption") { pastille = "New Eruption"; emoji = "🌋"; couleur = "#FF6A4D"; }
  if (d.jma && (d.cas === "jma" || d.cas === "etat" || (d.cas === "eruption" && d.n.jma))) { const m = d.jma.niveau_en?.match(/\(([^)]+)\)/); alerte = d.n.jma ? `Level ${d.n.jma} of 5${m ? ` (${m[1]})` : ""}` : d.jma.niveau_en; sourceJma = true; }
  if (d.usgs && (d.cas === "usgs" || d.cas === "etat" || (d.cas === "eruption" && d.n.usgs))) alerte = `${d.usgs.couleur[0] + d.usgs.couleur.slice(1).toLowerCase()} (${d.usgs.niveau[0] + d.usgs.niveau.slice(1).toLowerCase()})`;
  if (d.geonet && (d.cas === "geonet" || d.cas === "etat" || (d.cas === "eruption" && d.n.geonet))) alerte = `Level ${d.n.geonet}${d.geonet.texte ? ` (${d.geonet.texte.replace(/\.$/, "")})` : ""}`;
  if (d.cas === "etat") { pastille = d.statut === "eruption" ? "Erupting Now" : "Volcanic Unrest"; emoji = "🌋"; couleur = "#FF6A4D"; }
  else if (d.cas === "usgs") {
    const c = d.usgs.couleur; emoji = { YELLOW: "🟡", ORANGE: "🟠", RED: "🔴" }[c] ?? "🟠"; couleur = { YELLOW: "#F2D14B", ORANGE: "#F2A93B", RED: "#E5303A" }[c] ?? "#F2A93B";
    pastille = `USGS ${c[0] + c.slice(1).toLowerCase()} Alert`;
  } else if (d.cas !== "eruption") {
    const niv = d.cas === "jma" ? d.n.jma : d.n.geonet; // 3 orange, 4 red, 5 purple
    emoji = niv >= 5 ? "🟣" : niv >= 4 ? "🔴" : "🟠"; couleur = niv >= 5 ? "#B0124A" : niv >= 4 ? "#E5303A" : "#F2A93B";
    pastille = `Alert Level ${niv}`;
  }
  const titre = d.cas === "eruption" ? `🌋 New Eruption at ${court}${d.pays ? `, ${d.pays}` : ""}`
    : d.cas === "etat" ? `🌋 ${court} ${d.statut === "eruption" ? "Is Erupting" : "Shows Unrest"}${d.pays ? `, ${d.pays}` : ""}`
    : d.manuel ? `${emoji} ${court} at ${pastille}` : `${emoji} ${court} Raised to ${pastille}`;
  const coords = `${Math.abs(d.lat).toFixed(2)}°${d.lat >= 0 ? "N" : "S"} ${Math.abs(d.lon).toFixed(2)}°${d.lon >= 0 ? "E" : "W"}`;

  // Hashtags (config/hashtags.json): local word, volcano, country in English and in its own language, #Volcano, then a varied tag
  const H = HASHTAGS.volcans, [langue = "en", paysLocal] = (d.pays && HASHTAGS.pays[d.pays === "United States" ? "United States" : d.pays]) || [];
  const local = HASHTAGS.langues[langue]?.volcan?.[0] ?? HASHTAGS.langues.en.volcan[0];
  const lieux = [tag(court), d.pays ? tag(d.pays) : null, paysLocal ? tagLocal(paysLocal) : null].filter(Boolean);
  const v1 = variante(d.id, "v1", H.sismiques), v2 = H.sismiques[(H.sismiques.indexOf(v1) + 1) % H.sismiques.length], large = variante(d.id, "lg", H.larges);
  const u = (l) => [...new Set(l)].join(" ");
  const lignes = [
    `🌋 Volcano: ${court}`,
    `📍 Location: ${d.pays ? d.pays + " " : ""}(${coords})`,
    ...(alerte ? [`⚠️ Alert: ${alerte}`] : []),
    ...(annee ? [`📅 ${d.cas === "eruption" ? "Eruption Began" : "Erupting Since"}: ${d.cas === "eruption" ? new Date(d.depuis + "T00:00:00Z").toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : annee}`] : []),
  ];
  const source = sourceJma ? "\nSource: JMA" : "";
  const legendes = {
    x: `${titre}\n\n${lignes.join("\n")}\n\n👇 Live Map\n${d.lien}${source}\n\n${u([local, ...lieux, "#Volcano", v1])}`,
    instagram: `${titre}\n\n${lignes.join("\n")}\n\n🗺️ Live Map, Link in Bio${source}\n\n${u([local, ...lieux, "#Volcano", v1, v2, large])}`,
    facebook: `${titre}\n\n${lignes.join("\n")}\n\n👇 Live Map\n${d.lien}${source}\n\n${u([local, ...lieux.slice(0, 2), "#Volcano"])}`,
  };
  const ecran = {
    type: "volcan", couleur, pastille, nom: court, pays: d.pays, coords, date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
    ligne2: annee ? (d.cas === "eruption" ? `Eruption Began ${new Date(d.depuis + "T00:00:00Z").toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : `Erupting Since ${annee}`) : d.statut === "eruption" ? "Erupting Now" : "Unrest",
    faits: [
      ...(d.jma ? [d.n.jma ? ["alert", `${d.n.jma} of 5`, "JMA Alert Level"] : ["alert", d.jma.niveau_en, "JMA Warning"]] : []),
      ...(d.usgs ? [["plane", d.usgs.couleur[0] + d.usgs.couleur.slice(1).toLowerCase(), "Aviation Color Code"], ["alert", d.usgs.niveau[0] + d.usgs.niveau.slice(1).toLowerCase(), "USGS Alert Level"]] : []),
      ...(d.geonet ? [["alert", `Level ${d.n.geonet}`, "GeoNet Alert Level"]] : []),
    ].slice(0, 2),
  };
  return { ecran, legendes, lien: d.lien, type: "volcan" };
}
