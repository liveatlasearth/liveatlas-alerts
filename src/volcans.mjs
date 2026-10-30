// Volcano alerts for @LiveAtlasErupts, from the public Live Atlas data (www.liveatlas.earth/donnees/evenements.json, refreshed
// every hour from the Smithsonian GVP weekly report, USGS, JMA and GeoNet alert levels) and the public search index (English names and pages).
// Triggers (config/seuils.json): a new eruption, or an alert level raised to USGS orange or red, JMA level 3+, GeoNet level 3+,
// or to the threshold of a national observatory read directly (src/observatoires.mjs: PHIVOLCS, IMO, VMGD, IGP, KVERT, INGV, OVPF).
// Never a simple VAAC ash advisory.
import { join } from "node:path";
import { ajusterX, COMPTES, ecrireJson, json, lireJson, RACINE, variante } from "./commun.mjs";
import { geoAutour } from "./donnees.mjs";
import { ajouterObservatoires } from "./observatoires.mjs";

const SITE = "https://www.liveatlas.earth", HASHTAGS = lireJson("config", "hashtags.json");
const COULEURS = ["GREEN", "YELLOW", "ORANGE", "RED"];
let PAYS_NE = null;
const paysEn = (fr) => { if (!fr) return null; const f = (PAYS_NE ??= lireJson("donnees", "ne_pays_50m.geojson").features).find((x) => x.properties.NAME_FR === fr); return f ? ({ "United States of America": "United States", "Dem. Rep. Congo": "DR Congo", "Heard I. and McDonald Is.": "Heard Island" }[f.properties.NAME] ?? f.properties.NAME) : null; };

// Alert levels of one volcano as comparable numbers
export const niveaux = (v) => {
  const n = { usgs: 0, jma: 0, geonet: 0 };
  for (const a of v.alertes ?? []) {
    if (a.organisme === "USGS") n.usgs = COULEURS.indexOf(a.couleur) + 1;
    // JMA: codes 11 to 15 are the numbered levels 1 to 5. Other codes (22 "Danger Around the Crater", 36 "Marine Warning…")
    // are keyword warnings for volcanoes without levels: shown with their own words, never treated as a level
    if (a.organisme === "JMA" && a.code >= 11 && a.code <= 15) n.jma = a.code - 10;
    if (a.organisme === "GeoNet") n.geonet = +a.niveau || 0;
    // National observatories (src/observatoires.mjs): their rank, absent when the source did not answer (the remembered level stays)
    if (a.cle) n[a.cle] = a.rang;
  }
  return n;
};

export async function lireVolcans() { return ajouterObservatoires((await json(`${SITE}/donnees/evenements.json`)).volcans); }

// etat: { <id>: { eruption, usgs, jma, geonet, <national source key>, postes: { <source key>: time of the last post } } }
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
    // National observatories: a raise to the source's threshold or above. A level never remembered is only remembered (a new source
    // must not post every volcano already in alert), except PHIVOLCS, plugged in for Mayon's raise of Oct 30, 2026
    else for (const a of v.alertes ?? []) {
      const prec = avant[a.cle] ?? (a.zero ? 0 : undefined);
      if (!a.cle || prec === undefined || a.rang < a.seuil || a.rang <= prec) continue;
      if (a.delai && maintenant - (avant.postes?.[a.cle] ?? 0) < a.delai) continue; // INGV: one Etna post a week at most
      cas = a.cle; avant.postes = { ...avant.postes, [a.cle]: maintenant }; break;
    }
    if (cas) aFaire.push({ id: `v${v.id}`, volcan: v, cas, reseaux: ["x", "instagram", "facebook"] });
  }
  return aFaire;
}
export const memoriser = (volcans, etat) => { for (const v of volcans) etat[v.id] = { ...etat[v.id], eruption: v.statut === "eruption", ...niveaux(v) }; };

// State, province or island group of a volcano ("Hawaii", "Kagoshima", "Sicily", "Central Java"), from OpenStreetMap (Nominatim
// reverse geocoding, English names). None at sea (Home Reef, Ahyi) or if the service does not answer: the post goes out without it.
async function region(lat, lon, pays) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=5&accept-language=en`, { headers: { "user-agent": "liveatlas-alerts (+https://www.liveatlas.earth)" }, signal: AbortSignal.timeout(10000) });
    const a = (await r.json()).address ?? {}, nom = (a.state ?? a.province ?? a.region ?? a.archipelago)?.replace(/ (Prefecture|Krai|Oblast|Province|Region|State|Governorate)$/, "");
    return nom && nom !== pays && nom !== a.country ? nom : null;
  } catch { return null; }
}

// Everything needed for the images and captions of one volcano alert
export async function donneesVolcan(v, cas, manuel = false) {
  const index = await json(`${SITE}/donnees/recherche.json`), entree = (Array.isArray(index) ? index : Object.values(index)).find((x) => Array.isArray(x) && x[4] === "v" && x[2] === `/fr/volcans/${v.slug}/`);
  const nom = entree?.[1] ?? v.nom, lien = entree ? SITE + entree[3] : COMPTES.volcans.lien_volcans, pays = paysEn(v.pays);
  const n = niveaux(v), jma = v.alertes?.find((a) => a.organisme === "JMA"), usgs = v.alertes?.find((a) => a.organisme === "USGS"), geonet = v.alertes?.find((a) => a.organisme === "GeoNet"), nationales = (v.alertes ?? []).filter((a) => a.cle);
  const d = { id: `v${v.id}`, gvp: v.id, manuel, nom, pays, region: await region(v.lat, v.lon, pays), lon: v.lon, lat: v.lat, depuis: v.depuis, statut: v.statut, cas, lien, n, jma, usgs, geonet, nationales, geo: geoAutour(v.lon, v.lat) };
  ecrireJson(join(RACINE, "public", "evenements", d.id, "donnees.json"), d, false);
  return d;
}

const tag = (s) => "#" + s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
const tagLocal = (s) => "#" + s.replace(/[\s'’.,\-]/g, "");

export function textesVolcan(d) {
  const court = d.nom.replace(/\s*\(.*\)$/, ""), annee = d.depuis ? d.depuis.slice(0, 4) : null;
  // Alert line and pill, from the agency that raised it
  let pastille, alerte, emoji, couleur, source = null;
  if (d.cas === "eruption") { pastille = "New Eruption"; emoji = "🌋"; couleur = "#FF6A4D"; }
  if (d.jma && (d.cas === "jma" || d.cas === "etat" || (d.cas === "eruption" && d.n.jma))) { const m = d.jma.niveau_en?.match(/\(([^)]+)\)/); alerte = d.n.jma ? `Level ${d.n.jma} of 5${m ? ` (${m[1]})` : ""}` : d.jma.niveau_en; source = "JMA"; }
  // National observatory (src/observatoires.mjs): the one that raised it, or the first one known when the state is posted by hand
  const nat = d.nationales?.find((a) => a.cle === d.cas) ?? (["etat", "eruption"].includes(d.cas) ? d.nationales?.find((a) => a.rang >= a.seuil) : null);
  if (nat) { alerte = nat.alerte; source = nat.organisme; }
  if (d.usgs && (d.cas === "usgs" || d.cas === "etat" || (d.cas === "eruption" && d.n.usgs))) alerte = `${d.usgs.couleur[0] + d.usgs.couleur.slice(1).toLowerCase()} (${d.usgs.niveau[0] + d.usgs.niveau.slice(1).toLowerCase()})`;
  if (d.geonet && (d.cas === "geonet" || d.cas === "etat" || (d.cas === "eruption" && d.n.geonet))) alerte = `Level ${d.n.geonet}${d.geonet.texte ? ` (${d.geonet.texte.replace(/\.$/, "")})` : ""}`;
  if (d.cas === "etat") { pastille = d.statut === "eruption" ? "Erupting Now" : "Volcanic Unrest"; emoji = "🌋"; couleur = "#FF6A4D"; }
  else if (d.cas === "usgs") {
    const c = d.usgs.couleur; emoji = { YELLOW: "🟡", ORANGE: "🟠", RED: "🔴" }[c] ?? "🟠"; couleur = { YELLOW: "#F2D14B", ORANGE: "#F2A93B", RED: "#E5303A" }[c] ?? "#F2A93B";
    pastille = `USGS ${c[0] + c.slice(1).toLowerCase()} Alert`;
  } else if (d.cas !== "eruption") {
    const niv = d.cas === "jma" ? d.n.jma : d.cas === "geonet" ? d.n.geonet : nat.gravite; // 3 orange, 4 red, 5 purple
    emoji = niv >= 5 ? "🟣" : niv >= 4 ? "🔴" : "🟠"; couleur = niv >= 5 ? "#B0124A" : niv >= 4 ? "#E5303A" : "#F2A93B";
    pastille = nat ? nat.pastille : `Alert Level ${niv}`;
  }
  const titre = d.cas === "eruption" ? `🌋 New Eruption at ${court}${d.pays ? `, ${d.pays}` : ""}`
    : d.cas === "etat" ? `🌋 ${court} ${d.statut === "eruption" ? "Is Erupting" : "Shows Unrest"}${d.pays ? `, ${d.pays}` : ""}`
    : d.manuel ? `${emoji} ${court} at ${pastille}` : `${emoji} ${court} Raised to ${pastille}`;
  const coords = `${Math.abs(d.lat).toFixed(2)}°${d.lat >= 0 ? "N" : "S"} ${Math.abs(d.lon).toFixed(2)}°${d.lon >= 0 ? "E" : "W"}`;

  // Hashtags (config/hashtags.json): local word, volcano, country in English and in its own language, #Volcano, then a varied tag
  const H = HASHTAGS.volcans, [langue = "en", paysLocal] = (d.pays && HASHTAGS.pays[d.pays === "United States" ? "United States" : d.pays]) || [];
  const local = HASHTAGS.langues[langue]?.volcan?.[0] ?? HASHTAGS.langues.en.volcan[0];
  const lieux = [tag(court), d.region ? tag(d.region) : null, d.pays ? tag(d.pays) : null, paysLocal ? tagLocal(paysLocal) : null].filter(Boolean);
  const ou = [d.region, d.pays].filter(Boolean).join(", ");
  const v1 = variante(d.id, "v1", H.sismiques), v2 = H.sismiques[(H.sismiques.indexOf(v1) + 1) % H.sismiques.length], large = variante(d.id, "lg", H.larges);
  const u = (l) => [...new Set(l)].join(" ");
  const lignes = [
    `🌋 Volcano: ${court}`,
    `📍 Location: ${ou ? ou + " " : ""}(${coords})`,
    ...(alerte ? [`⚠️ Alert: ${alerte}`] : []),
    ...(annee ? [`📅 ${d.cas === "eruption" ? "Eruption Began" : "Erupting Since"}: ${d.cas === "eruption" ? new Date(d.depuis + "T00:00:00Z").toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : annee}`] : []),
  ];
  const sourceL = source ? `\nSource: ${source}` : "";
  const legendes = {
    x: ajusterX(`${titre}\n\n${lignes.join("\n")}\n\n👇 Live Map\n${d.lien}${sourceL}\n\n`, u([local, ...lieux, "#Volcano", v1]).split(" "), [local, "#Volcano"]),
    instagram: `${titre}\n\n${lignes.join("\n")}\n\n🗺️ Live Map, Link in Bio${sourceL}\n\n${u([local, ...lieux, "#Volcano", v1, v2, large])}`,
    facebook: `${titre}\n\n${lignes.join("\n")}\n\n👇 Live Map\n${d.lien}${sourceL}\n\n${u([local, ...lieux.slice(0, d.region ? 3 : 2), "#Volcano"])}`,
  };
  const ecran = {
    type: "volcan", couleur, pastille, nom: court, pays: ou || null, coords, date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
    ligne2: annee ? (d.cas === "eruption" ? `Eruption Began ${new Date(d.depuis + "T00:00:00Z").toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : `Erupting Since ${annee}`) : d.statut === "eruption" ? "Erupting Now" : "Unrest",
    faits: [
      ...(d.jma ? [d.n.jma ? ["alert", `${d.n.jma} of 5`, "JMA Alert Level"] : ["alert", d.jma.niveau_en, "JMA Warning"]] : []),
      ...(d.usgs ? [["plane", d.usgs.couleur[0] + d.usgs.couleur.slice(1).toLowerCase(), "Aviation Color Code"], ["alert", d.usgs.niveau[0] + d.usgs.niveau.slice(1).toLowerCase(), "USGS Alert Level"]] : []),
      ...(d.geonet ? [["alert", `Level ${d.n.geonet}`, "GeoNet Alert Level"]] : []),
      ...(d.nationales ?? []).map((a) => [a.icone, a.valeur, a.libelle]),
    ].slice(0, 2),
  };
  return { ecran, legendes, lien: d.lien, type: "volcan" };
}
