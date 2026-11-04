// Regular posts of the alert accounts, so that both post every day and not only on events (user request of Nov 4, 2026;
// schedule in config/seuils.json, "rubriques"):
// @LiveAtlasErupts, from 15:00 UTC: Mon Erupting Now, Tue Volcano Spotlight, Wed On This Day, Thu Alert Levels,
//   Fri Volcanoes This Week (Smithsonian / USGS weekly report when less than 8 days old, else Erupting Now), Sat On This Day,
//   Sun Volcano Spotlight. On This Day falls back to a Spotlight on the dates without a known eruption.
// @LiveAtlasQuakes: Earthquakes of the Day (M4.5+ of the past UTC day) from 00:15 UTC; On This Day from 18:00 UTC when no
//   Instagram earthquake post went out that day.
// Each post goes to sortie/<id>/ like an alert (image, legendes.json, issue.md, reseaux.txt, titre.txt). It is published on
// Instagram and Facebook only when seuils.rubriques.publier is true; otherwise the issue holds it for review.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ajusterX, classe, COMPTES, json, lireJson, nf, RACINE, SEUILS, titreLieu, variante, ecrireJson } from "./commun.mjs";
import { geoAutour } from "./donnees.mjs";
import { donneesVolcan, lireVolcans, textesVolcan } from "./volcans.mjs";
import { imageRubrique, reelLieu } from "./rendre.mjs";
import { vueSatellite } from "./satellite.mjs";

const SITE = "https://www.liveatlas.earth", R = SEUILS.rubriques, SORTIE = join(RACINE, "sortie");
const MOIS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dateCourte = (ms) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dateLongue = (ms) => new Date(ms).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const tag = (s) => "#" + s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
const u = (l) => [...new Set(l.filter(Boolean))].slice(0, 6).join(" ");
// Severity shared by every agency: 1 green, 2 yellow, 3 orange, 4 red, 5 purple (USGS colors, JMA and GeoNet levels, national scales)
const TEINTE = { 1: "#3DDC97", 2: "#F2D14B", 3: "#F2A93B", 4: "#E5303A", 5: "#B0124A" };
// Eruption size in plain words (no "VEI" on screen, rule of Oct 13, 2026): 0–1 small, 2 moderate, 3 mid-size, 4 large, 5+ very large
const TAILLE = (vei) => vei == null ? null : vei <= 1 ? "Small" : vei === 2 ? "Moderate" : vei === 3 ? "Mid-Size" : vei === 4 ? "Large" : "Very Large";
// Spoken text of the reels: "the" before the countries that take it; "people" or "person"
const le = (pays) => /^(Philippines|United States|United Kingdom|Netherlands|Dominican Republic|Czech Republic|Central African Republic|Bahamas)$|Islands$/.test(pays) ? `the ${pays}` : pays;
const gens = (n) => `${nf.format(n)} ${n === 1 ? "person" : "people"}`;
// State and alert facts of a volcano post said aloud ("The JMA alert level is 3 of 5.", "The aviation color code is orange.")
const minus = (s) => s.replace(/\b[A-Z][a-z]+\b/g, (w) => w.toLowerCase());
const etatDit = (e) => [
  /^Erupting Since \d{4}$/.test(e.ligne2) ? `It has been erupting since ${e.ligne2.slice(-4)}.` : e.ligne2 === "Erupting Now" ? "It is erupting right now." : e.ligne2 === "Unrest" ? "It is showing signs of unrest." : null,
  ...e.faits.map(([, v, l]) => /Warning$/.test(l) ? `A ${minus(v)} is in effect.` : `The ${minus(l)} is ${minus(v)}.`),
].filter(Boolean).join(" ");

// English names and countries of the site's volcanoes (the live data has French names)
let EN = null, PAYS = null;
const nomEn = async (v) => (EN ??= await json(`${SITE}/donnees/volcans-en.json`))[v.id]?.[0] ?? v.nom;
const paysEn = (fr) => { if (!fr) return null; const f = (PAYS ??= lireJson("donnees", "ne_pays_50m.geojson").features).find((x) => x.properties.NAME_FR === fr); return f ? ({ "United States of America": "United States", "Dem. Rep. Congo": "DR Congo" }[f.properties.NAME] ?? f.properties.NAME) : fr; };

// Highest alert of a volcano, any agency, as { gravite, valeur }
const alerteMax = (v) => {
  let m = null;
  for (const a of v.alertes ?? []) {
    let g = 0, valeur = "";
    if (a.organisme === "USGS") { g = ["GREEN", "YELLOW", "ORANGE", "RED"].indexOf(a.couleur) + 1; valeur = `USGS ${a.couleur.toLowerCase()}`; }
    else if (a.organisme === "JMA" && a.code >= 11 && a.code <= 15) { g = a.code - 10; valeur = `Level ${g} of 5`; }
    else if (a.organisme === "GeoNet") { g = +a.niveau || 0; valeur = `Level ${g} of 5`; }
    else if (a.cle) { g = a.gravite; valeur = a.libelle === "Aviation Color Code" ? `Aviation ${a.valeur}` : /of 5$/.test(a.valeur) ? `Level ${a.valeur}` : a.valeur; }
    if (g > (m?.gravite ?? 0)) m = { gravite: g, valeur };
  }
  return m;
};

// ---------- Volcano posts ----------
async function eruptingNow(volcans, jour) {
  const ici = volcans.filter((v) => v.statut === "eruption").sort((a, b) => (b.depuis ?? "").localeCompare(a.depuis ?? ""));
  const lignes = [];
  for (const v of ici.slice(0, 6)) lignes.push({ nom: await nomEn(v), lieu: paysEn(v.pays), valeur: v.depuis ? `Since ${new Date(v.depuis).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}` : "", couleur: "#FF6A4D", lon: v.lon, lat: v.lat });
  const titre = `${ici.length} Volcanoes Erupting Right Now`;
  return {
    composition: "rubrique", type: "volcan",
    ecran: { compte: "volcans", couleur: "#FF6A4D", date: dateCourte(jour), pastille: "Erupting Now", titre, sousTitre: "The six newest eruptions, numbered on the map",
      points: ici.map((v) => ({ lon: v.lon, lat: v.lat, couleur: "#FF6A4D", n: lignes.findIndex((l) => l.lon === v.lon && l.lat === v.lat) + 1 || undefined })), lignes },
    titre: `🌋 ${titre}`, lignes: lignes.map((l, i) => `${i + 1}. ${l.nom}, ${l.lieu} (${l.valeur})`),
    lien: COMPTES.volcans.lien_volcans, source: "Smithsonian GVP, USGS, national observatories",
    hashtags: ["#Volcanoes", "#VolcanicEruption", "#Volcanology", ...lignes.slice(0, 3).map((l) => tag(l.nom))],
  };
}

async function alertLevels(volcans, jour) {
  const ici = volcans.map((v) => ({ v, a: alerteMax(v) })).filter((x) => x.a && x.a.gravite >= 2).sort((a, b) => b.a.gravite - a.a.gravite || (b.v.depuis ?? "").localeCompare(a.v.depuis ?? ""));
  const hauts = ici.filter((x) => x.a.gravite >= 3).length, lignes = [];
  for (const { v, a } of ici.slice(0, 6)) lignes.push({ nom: await nomEn(v), lieu: paysEn(v.pays), valeur: a.valeur, couleur: TEINTE[Math.min(a.gravite, 5)], lon: v.lon, lat: v.lat });
  const titre = `${hauts} Volcanoes at Orange or Red`;
  return {
    composition: "rubrique", type: "volcan",
    ecran: { compte: "volcans", couleur: "#F2A93B", date: dateCourte(jour), pastille: "Alert Levels", titre, sousTitre: `${ici.length} volcanoes above normal, highest first`,
      points: ici.map(({ v, a }) => ({ lon: v.lon, lat: v.lat, couleur: TEINTE[Math.min(a.gravite, 5)], n: lignes.findIndex((l) => l.lon === v.lon && l.lat === v.lat) + 1 || undefined })), lignes },
    titre: `⚠️ ${titre}`, lignes: lignes.map((l, i) => `${i + 1}. ${l.nom}, ${l.lieu} (${l.valeur})`),
    lien: COMPTES.volcans.lien_volcans, source: "USGS, JMA, GeoNet, national observatories",
    hashtags: ["#Volcano", "#VolcanoAlert", "#Volcanology", ...lignes.slice(0, 3).map((l) => tag(l.nom))],
  };
}

// Smithsonian / USGS Weekly Volcanic Activity Report (RSS, updated on Thursdays): names, countries and positions only, no text copied
async function cetteSemaine(volcans, jour) {
  const r = await fetch("https://volcano.si.edu/news/WeeklyVolcanoRSS.xml", { headers: { "user-agent": "liveatlas-alerts (+https://www.liveatlas.earth)" }, signal: AbortSignal.timeout(30000) });
  const xml = Buffer.from(await r.arrayBuffer()).toString("latin1"), date = Date.parse(xml.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? "");
  if (!r.ok || !date || jour - date > 8 * 86400e3) return null;
  const items = [...xml.matchAll(/<item>[\s\S]*?<title>([^<]+?) \(([^)]+)\) - Report for ([^<]+?) - (New|Continuing) Eruptive Activity<\/title>[\s\S]*?(?:<georss:point>([-\d.]+) ([-\d.]+)<\/georss:point>)?[\s\S]*?<\/item>/g)]
    .map(([, nom, pays, periode, type, lat, lon]) => ({ nom, pays, periode, nouveau: type === "New", lat: +lat, lon: +lon })).filter((x) => !isNaN(x.lat));
  if (!items.length) return null;
  const nouveaux = items.filter((x) => x.nouveau), liste = [...nouveaux, ...items.filter((x) => !x.nouveau)].slice(0, 6);
  const lignes = liste.map((x) => ({ nom: x.nom, lieu: x.pays, valeur: x.nouveau ? "New Activity" : "Ongoing", couleur: x.nouveau ? "#FF6A4D" : "#F2A93B", lon: x.lon, lat: x.lat }));
  const titre = "Volcanoes This Week";
  return {
    composition: "rubrique", type: "volcan",
    ecran: { compte: "volcans", couleur: "#FF6A4D", date: dateCourte(jour), pastille: "Weekly Report", titre, sousTitre: `${nouveaux.length} with new activity, ${items.length - nouveaux.length} still erupting (${items[0].periode})`,
      points: items.map((x) => ({ lon: x.lon, lat: x.lat, couleur: x.nouveau ? "#FF6A4D" : "#F2A93B", n: liste.indexOf(x) + 1 || undefined })), lignes },
    titre: `🌋 ${titre}: ${nouveaux.length} With New Activity`, lignes: [`📅 ${items[0].periode}`, ...lignes.map((l, i) => `${i + 1}. ${l.nom}, ${l.lieu} (${l.valeur})`)],
    lien: COMPTES.volcans.lien_volcans, source: "Smithsonian / USGS Weekly Volcanic Activity Report",
    hashtags: ["#Volcanoes", "#VolcanicActivity", "#Volcanology", ...nouveaux.slice(0, 3).map((x) => tag(x.nom))],
  };
}

// One erupting or restless volcano, in turn (a stable pick of the date), never one shown in the last 8 weeks
async function spotlight(volcans, jour, etat) {
  const vus = Object.keys(etat._rubriques ?? {}).filter((k) => k.startsWith("spot-")).map((k) => +k.slice(5));
  const libres = volcans.filter((x) => !vus.includes(x.id)).sort((a, b) => a.id - b.id);
  const v = libres.length ? variante(new Date(jour).toISOString().slice(0, 10), "spot", libres) : null;
  if (!v) return null;
  const d = await donneesVolcan(v, "etat"), txt = textesVolcan(d), court = d.nom.replace(/\s*\(.*\)$/, "");
  const titre = `🔦 Volcano Spotlight: ${court}${d.pays && d.pays !== court ? `, ${d.pays}` : ""}`;
  const legendes = Object.fromEntries(Object.entries(txt.legendes).map(([r, s]) => [r, s.replace(/^[^\n]*/, titre)]));
  const satellite = await vueSatellite(d.lon, d.lat, join(RACINE, "public", "evenements", d.id, "satellite.jpg")).catch(() => null);
  const ecran = { ...txt.ecran, pastille: "Volcano Spotlight" }, ou = ecran.pays && (ecran.pays.includes(",") ? ecran.pays : le(ecran.pays));
  return { volcanId: v.id, dossier: d.id, composition: "volcan-carre", type: "volcan", ecran, legendesPretes: legendes, lien: d.lien, titre, satellite, lon: d.lon, lat: d.lat,
    reel: { accroche: `Volcano Spotlight: ${court}${ou ? `, in ${ou}` : ""}.`, lieu: etatDit(ecran), fin: "Follow it on the live map, link in bio." } };
}

async function ceJourVolcan(jour) {
  const md = new Date(jour).toISOString().slice(5, 10), liste = lireJson("donnees", "ce-jour.json").eruptions.filter((e) => e[0] === md);
  const e = liste.sort((a, b) => (b[4] ?? -1) - (a[4] ?? -1) || (b[5] ?? 0) - (a[5] ?? 0))[0];
  if (!e) return null;
  const [, annee, nom, pays, vei, morts, slug, lon, lat] = e, quand = `${MOIS[+md.slice(0, 2) - 1]} ${+md.slice(3)}, ${annee}`, taille = TAILLE(vei);
  const id = `ce-jour-v-${md}`;
  ecrireJson(join(RACINE, "public", "evenements", id, "donnees.json"), { id, lon, lat, geo: geoAutour(lon, lat) }, false);
  const satellite = await vueSatellite(lon, lat, join(RACINE, "public", "evenements", id, "satellite.jpg")).catch(() => null);
  return {
    dossier: id, composition: "volcan-carre", type: "volcan", satellite,
    ecran: { compte: "volcans", couleur: "#F2A93B", date: dateCourte(jour), pastille: "On This Day", nom, pays, ligne2: `Erupted ${quand}`, coords: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`,
      faits: [...(taille ? [["gauge", taille, "Eruption Size"]] : []), ...(morts ? [["users", nf.format(morts), morts === 1 ? "Death" : "Deaths"]] : [])] },
    titre: `📅 On This Day in ${annee}: ${nom} Erupted, ${pays}`,
    lignes: [`🌋 Volcano: ${nom}`, `📍 Location: ${pays}`, `📅 Date: ${quand}`, ...(taille ? [`📏 Eruption Size: ${taille} (VEI ${vei})`] : []), ...(morts ? [`💀 Deaths: ${nf.format(morts)}`] : [])],
    lien: `${SITE}/eruptions/${slug}/`, libelleLien: "The Full Story", source: "NOAA NCEI, Smithsonian GVP",
    hashtags: ["#Volcano", tag(nom), tag(pays), "#OnThisDay", "#VolcanoHistory", "#Volcanology"], lon, lat,
    reel: { accroche: `On this day in ${annee}, ${nom} erupted in ${le(pays)}.`, fin: "Read the full story on Live Atlas, link in bio.",
      lieu: taille ? `It was a ${taille.toLowerCase()} eruption${morts ? `, and it killed ${gens(morts)}` : ""}.` : morts ? `It killed ${gens(morts)}.` : "Here is where it happened." },
  };
}

// ---------- Earthquake posts ----------
const lieuLisible = (place = "") => { const m = place.match(/^\d+ km [NSEW]{1,3} of (.+)$/); return m ? `Near ${m[1]}` : titreLieu(place.replace(/ region$/, "")); };

async function seismesDuJour(jour) {
  const debut = new Date(jour - 86400e3).toISOString().slice(0, 10), fin = new Date(jour).toISOString().slice(0, 10);
  const f = (await json(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${debut}&endtime=${fin}&minmagnitude=4.5&orderby=magnitude`)).features;
  if (!f.length) return null;
  const top = f.slice(0, 6), fort = f[0].properties, cf = classe(fort.mag);
  const lignes = top.map((q) => ({ nom: `M${q.properties.mag.toFixed(1)}`, lieu: lieuLisible(q.properties.place), valeur: new Date(q.properties.time).toISOString().slice(11, 16) + " UTC", couleur: classe(q.properties.mag).couleur, id: q.id }));
  const n5 = f.filter((q) => q.properties.mag >= 5).length, quand = dateLongue(jour - 86400e3);
  const titre = `${f.length} Earthquakes M4.5+`;
  return {
    composition: "rubrique", type: "seisme",
    ecran: { compte: "seismes", couleur: cf.couleur, date: dateCourte(jour - 86400e3), pastille: "Earthquakes of the Day", titre, sousTitre: `${quand} (UTC). ${n5} of magnitude 5 or more`,
      points: f.map((q) => ({ lon: q.geometry.coordinates[0], lat: q.geometry.coordinates[1], couleur: classe(q.properties.mag).couleur, taille: 5 + (q.properties.mag - 4.5) * 5, n: top.indexOf(q) + 1 || undefined })), lignes },
    titre: `🌍 ${f.length} Earthquakes M4.5+ on ${quand}`,
    lignes: [`${cf.emoji} Strongest: M${fort.mag.toFixed(1)}, ${lieuLisible(fort.place)}`, `📊 Magnitude 5+: ${n5}`, "", ...lignes.map((l, i) => `${i + 1}. ${l.nom} ${l.lieu} (${l.valeur})`)],
    lien: `${SITE}/`, source: "USGS",
    hashtags: ["#Earthquakes", "#EarthquakeNews", "#Seismology", ...[...new Set(top.map((q) => q.properties.place.split(", ").at(-1).replace(/ region$/, "")))].slice(0, 3).map(tag)],
  };
}

function ceJourSeisme(jour) {
  const md = new Date(jour).toISOString().slice(5, 10), liste = lireJson("donnees", "ce-jour.json").seismes.filter((s) => s[0] === md);
  const s = liste.sort((a, b) => (b[2] + Math.log10(1 + (b[5] ?? 0)) / 2) - (a[2] + Math.log10(1 + (a[5] ?? 0)) / 2))[0];
  if (!s) return null;
  const [, annee, mag, nomBrut, pays, morts, slug, lon, lat, tsunami, prof] = s, c = classe(mag), quand = `${MOIS[+md.slice(0, 2) - 1]} ${+md.slice(3)}, ${annee}`;
  // Event name as on the site page, without its year ("1952 Severo-Kurilsk Tsunami" → "Severo-Kurilsk Tsunami"); else "<country> Earthquake"
  const nom = nomBrut ? nomBrut.replace(new RegExp(`^${annee} | of ${annee}$`, "g"), "") : `${pays} Earthquake`;
  const id = `ce-jour-s-${md}`;
  ecrireJson(join(RACINE, "public", "evenements", id, "donnees.json"), { id, lon, lat, geo: geoAutour(lon, lat) }, false);
  return {
    dossier: id, composition: "volcan-carre", type: "seisme",
    ecran: { compte: "seismes", couleur: c.couleur, date: dateCourte(jour), pastille: "On This Day", nom, pays: nomBrut ? pays : null, ligne2: quand, coords: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`,
      faits: [["gauge", `M${mag.toFixed(1)}`, "Magnitude"], ...(morts ? [["users", nf.format(morts), morts === 1 ? "Death" : "Deaths"]] : tsunami ? [["alert", "Tsunami", "Followed"]] : [])] },
    titre: `📅 On This Day in ${annee}: ${nomBrut ? nom : `M${mag.toFixed(1)} Earthquake in ${pays}`}`,
    lignes: [`📏 Magnitude: ${mag.toFixed(1)} (${c.nom})`, `📍 Location: ${pays}`, `📅 Date: ${quand}`, ...(prof ? [`⬇️ Depth: ${Math.round(prof / 1.609344)} mi (${prof} km)`] : []), ...(morts ? [`💀 Deaths: ${nf.format(morts)}`] : []), ...(tsunami ? ["🌊 Followed by a tsunami"] : [])],
    lien: `${SITE}/earthquakes/${slug}/`, libelleLien: "The Full Story", source: "NOAA NCEI",
    hashtags: ["#Earthquake", tag(pays), `#Earthquake${tag(pays).slice(1)}`, "#OnThisDay", "#EarthquakeHistory", "#Seismology"], lon, lat,
    reel: { accroche: `On this day in ${annee}, a magnitude ${mag.toFixed(1)} earthquake struck ${le(pays)}.`, fin: "Read the full story on Live Atlas, link in bio.",
      lieu: [nomBrut && nom !== `${pays} Earthquake` ? `It is known as the ${nom}.` : null, morts ? `It killed ${gens(morts)}${tsunami ? ", and a tsunami followed" : ""}.` : tsunami ? "A tsunami followed." : prof ? `It started ${Math.round(prof / 1.609344)} miles deep.` : null].filter(Boolean).join(" ") || "Here is where it struck." },
  };
}

// ---------- Captions, files, schedule ----------
function legendes(p) {
  const corps = [p.titre, "", ...p.lignes].join("\n"), lib = p.libelleLien ?? "Live Map", src = p.source ? `\nSource: ${p.source}` : "";
  return {
    x: ajusterX(`${corps}\n\n👇 ${lib}\n${p.lien}${src}\n\n`, u(p.hashtags).split(" "), []),
    instagram: `${corps}\n\n🗺️ ${lib}, Link in Bio${src}\n\n${u(p.hashtags)}`,
    facebook: `${corps}\n\n👇 ${lib}\n${p.lien}${src}\n\n${u(p.hashtags).split(" ").slice(0, 4).join(" ")}`,
  };
}

// Captions of a post, with the satellite and date of the view from space (src/satellite.mjs) on Instagram and Facebook
const satQuand = (p) => dateCourte(Date.parse(p.satellite.date + "T12:00:00Z"));
function texte(p) {
  const txt = { type: p.type, lien: p.lien, legendes: { ...(p.legendesPretes ?? legendes(p)) } };
  if (p.satellite) for (const r of ["instagram", "facebook"]) txt.legendes[r] = txt.legendes[r].replace(/\n\n(🗺️|👇)/u, `\n🛰️ Satellite View: ${p.satellite.capteur}, ${satQuand(p)} (${p.satellite.credit})\n\n$1`);
  return txt;
}
function fichiersTexte(sortie, p, jour, txt, reseaux, etat) {
  writeFileSync(join(sortie, "legendes.json"), JSON.stringify(txt, null, 1));
  writeFileSync(join(sortie, "reseaux.txt"), reseaux.join(",") || "brouillon");
  writeFileSync(join(sortie, "titre.txt"), `${p.titre ?? txt.legendes.x.split("\n")[0]}${txt.narration ? " · Reel" : ""} (${reseaux.length ? reseaux.join(", ") : "draft, not published"})`);
  writeFileSync(join(sortie, "issue.md"), [`**Regular post${txt.narration ? " (reel)" : ""}** · ${p.type === "volcan" ? "@LiveAtlasErupts" : "@LiveAtlasQuakes"} · ${new Date(jour).toISOString().slice(0, 10)} · [Link](${p.lien})`, "", etat, "",
    "### X", "```", txt.legendes.x, "```", "", "### Instagram", "```", txt.legendes.instagram, "```", "", "### Facebook", "```", txt.legendes.facebook, "```", "",
    ...(txt.narration ? ["### Narration", "```", txt.narration, "```", ""] : [])].join("\n"));
}

async function ecrire(id, p, jour) {
  const sortie = join(SORTIE, id), dossier = p.dossier ?? id;
  mkdirSync(sortie, { recursive: true });
  if (!p.dossier) { const { monde, plaques } = geoAutour(0, 0); ecrireJson(join(RACINE, "public", "evenements", id, "donnees.json"), { id, geo: { monde, plaques } }, false); }
  const fichiers = await imageRubrique(dossier, p.composition, p.ecran, sortie), txt = texte(p);
  // Second image, the volcano seen from space
  if (p.satellite) fichiers.push(...await imageRubrique(dossier, "volcan-satellite", { ...p.ecran, satLigne: `${p.satellite.capteur} Satellite, ${satQuand(p)}` }, sortie, "post-4x5-satellite.jpg"));
  const publier = R.publier, reseaux = publier ? ["x", "instagram", "facebook"] : [];
  fichiersTexte(sortie, p, jour, txt, reseaux, publier ? "Networks: x, instagram, facebook." : "Draft for review (seuils.rubriques.publier is false): nothing was published.");
  return { id, rubrique: true, reseaux, fichiers };
}

// Reel version of a one-place post (remotion/ReelLieu.jsx): globe, the place and its facts, the view from space if any, end card.
// The narration only says what the post shows (p.reel: hook and facts sentences written by each post).
async function ecrireReel(id, p, jour, publier) {
  const e = p.ecran, sat = p.satellite, an = (iso) => iso.slice(0, 4) !== new Date(jour).toISOString().slice(0, 4);
  const quand = sat && new Date(sat.date + "T12:00:00Z").toLocaleString("en-US", { month: "long", day: "numeric", timeZone: "UTC", ...(an(sat.date) ? { year: "numeric" } : {}) });
  const narration = [p.reel.accroche, p.reel.lieu, ...(sat ? [`Here it is from space, seen by a ${sat.capteur} satellite on ${quand}.`] : []), p.reel.fin].join("\n\n");
  const d = { compte: p.type === "volcan" ? "volcans" : "seismes", couleur: e.couleur, lon: p.lon, lat: p.lat, pastille: e.pastille, nom: e.nom, sousTitre: e.pays && !e.nom.includes(e.pays) ? e.pays : null, ligneDate: e.ligne2, coords: e.coords,
    faits: e.faits.map(([, v, l]) => [v, l]), satLigne: sat ? `${sat.capteur} Satellite, ${satQuand(p)}` : "", date: e.date.toUpperCase() };
  const sortie = join(SORTIE, id), fichiers = await reelLieu(p.dossier, d, ["accroche", "lieu", ...(sat ? ["satellite"] : []), "fin"], narration, sortie);
  const reseaux = publier ? ["reel"] : [];
  fichiersTexte(sortie, p, jour, { ...texte(p), narration }, reseaux, publier ? "Networks: Instagram and Facebook reel (X by hand)." : "Draft reel for review (seuils.rubriques.reels.publier is false): nothing was published; the image post went out as usual.");
  return { id, rubrique: true, reel: true, reseaux, fichiers };
}

// Days when the post is (also) a reel: seuils.rubriques.reels, getUTCDay (Sunday 0). Published instead of the image once
// reels.publier is true, else built as a draft next to the image post. A failed reel never stops the image post.
async function publierPost(id, p, jour, reelDuJour) {
  const RR = R.reels ?? {};
  if (reelDuJour && p.reel && RR.publier) try { return [await ecrireReel(id, p, jour, true)]; } catch (e) { console.log("Reel de rubrique : échec, post image à la place :", e.message); }
  const faits = [await ecrire(id, p, jour)];
  if (reelDuJour && p.reel && !RR.publier) try { faits.push(await ecrireReel(`${id}-reel`, p, jour, false)); } catch (e) { console.log("Reel de rubrique (brouillon) : échec :", e.message); }
  return faits;
}

const JOURS_V = ["spotlight", "erupting", "spotlight", "onthisday", "alertes", "semaine", "onthisday"]; // Sunday first (getUTCDay)

// etat: memory of the earthquake alerts (etat/publies.json), etat._rubriques = { "<post>-<date>": time } and "spot-<id>" for the Spotlights.
// faitsDuJour(r): posts of the day on network r. manuel: "rubrique:<name>[:<YYYY-MM-DD>]" builds one by hand (names: erupting,
// spotlight, onthisday, alertes, semaine, seismes, onthisday-seismes), whatever the time and the memory.
export async function rubriques(etat, maintenant, faitsDuJour, manuel) {
  const faits = [], memo = (etat._rubriques ??= {}), heure = new Date(maintenant).getUTCHours() * 60 + new Date(maintenant).getUTCMinutes();
  const [, nomManuel, dateManuelle] = manuel?.split(":") ?? [], jour = dateManuelle ? Date.parse(dateManuelle + "T12:00:00Z") : maintenant, date = new Date(jour).toISOString().slice(0, 10);
  const fait = (k) => { memo[k] = new Date().toISOString(); };

  // Volcanoes
  const cleV = `volcans-${date}`, sorte = nomManuel ?? (heure >= R.volcans_heure_utc * 60 && !memo[cleV] ? JOURS_V[new Date(jour).getUTCDay()] : null);
  if (sorte && ["erupting", "spotlight", "onthisday", "alertes", "semaine"].includes(sorte)) {
    const volcans = await lireVolcans();
    let p = sorte === "erupting" ? await eruptingNow(volcans, jour) : sorte === "alertes" ? await alertLevels(volcans, jour)
      : sorte === "semaine" ? (await cetteSemaine(volcans, jour).catch(() => null) ?? await eruptingNow(volcans, jour)) : sorte === "onthisday" ? await ceJourVolcan(jour) : null;
    if (!p) p = await spotlight(volcans, jour, etat);
    if (p) {
      console.log(`\n== Rubrique volcans ${date} : ${sorte}${p.volcanId ? ` (${p.volcanId})` : ""}`);
      faits.push(...await publierPost(`rubrique-${cleV}`, p, jour, (R.reels?.jours_volcans ?? []).includes(new Date(jour).getUTCDay())));
      if (!manuel) { fait(cleV); if (p.volcanId) fait(`spot-${p.volcanId}`); }
    }
  }

  // Earthquakes of the past UTC day, from 00:15 UTC
  const hier = new Date(jour - 86400e3).toISOString().slice(0, 10), cleS = `seismes-${hier}`;
  if (nomManuel === "seismes" || (!manuel && heure >= R.seismes_du_jour_minute_utc && !memo[cleS])) {
    const p = await seismesDuJour(jour);
    if (p) { console.log(`\n== Rubrique séismes du ${hier}`); faits.push(await ecrire(`rubrique-${cleS}`, p, jour)); }
    if (!manuel) fait(cleS);
  }

  // Earthquake On This Day, from 18:00 UTC, only on a day without an Instagram earthquake post, except on its reel days
  const cleJ = `ce-jour-seismes-${date}`, reelJ = (R.reels?.jours_seismes ?? []).includes(new Date(jour).getUTCDay());
  if (nomManuel === "onthisday-seismes" || (!manuel && heure >= R.ce_jour_seismes_heure_utc * 60 && !memo[cleJ] && (faitsDuJour("instagram") === 0 || reelJ))) {
    const p = ceJourSeisme(jour);
    if (p) { console.log(`\n== Rubrique séisme On This Day ${date}`); faits.push(...await publierPost(`rubrique-${cleJ}`, p, jour, reelJ)); }
    if (!manuel) fait(cleJ);
  }
  // Keep three weeks of memory (Spotlights: eight weeks, so a volcano is not shown again too soon)
  for (const [k, v] of Object.entries(memo)) if (Date.now() - Date.parse(v) > (k.startsWith("spot-") ? 56 : 21) * 86400e3) delete memo[k];
  return faits;
}
