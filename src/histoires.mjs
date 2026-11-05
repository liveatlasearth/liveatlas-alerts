// Story of the reels of the regular posts (user request of Nov 5, 2026: 30–45 s, a strong hook with a real image, more to learn,
// each type different). One scene per narration paragraph (remotion/ReelLieu.jsx); every figure comes from data:
//   donnees/histoire.json (social/alertes/ce-jour.mjs): Smithsonian GVP eruption list, NOAA NCEI significant eruptions and
//     earthquakes (deaths, causes, injured, homes), people around the volcanoes, plates (Bird 2002), photos of the site pages;
//   the USGS catalog for the aftershocks and the strongest quake since; Wikimedia Commons for photos and videos (src/medias.mjs).
// When a piece of data is missing, its scene is left out, never filled with a guess.
import { join } from "node:path";
import { ecrireJson, json, lireJson, nf, RACINE } from "./commun.mjs";
import { chercher, imageWikidata, premier, telecharger } from "./medias.mjs";

const MOIS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Eruption size in plain words (no "VEI" on screen, rule of Oct 13, 2026): 0–1 small, 2 moderate, 3 mid-size, 4 large, 5+ very large
export const TAILLE = (vei) => vei == null ? null : vei <= 1 ? "Small" : vei === 2 ? "Moderate" : vei === 3 ? "Mid-Size" : vei === 4 ? "Large" : "Very Large";
// Spoken text: "the" before the countries that take it; "people" or "person"
export const le = (pays) => /^(Philippines|United States|United Kingdom|Netherlands|Dominican Republic|Czech Republic|Central African Republic|Bahamas)$|Islands$/.test(pays) ? `the ${pays}` : pays;
export const gens = (n) => `${nf.format(n)} ${n === 1 ? "person" : "people"}`;
const pieds = (m) => Math.round(m * 3.28084);
// "more than 630,000" (two significant figures, rounded down)
const plusDe = (n) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1), r = Math.floor(n / p) * p; return r === n ? nf.format(n) : `more than ${nf.format(r)}`; };
const an = (a) => (a < 0 ? `${-a} BC` : String(a));
// Causes of death of the NOAA NCEI eruptions (same words as the site pages), spoken and as chips
const CAUSES = { P: ["pyroclastic flows", "Pyroclastic Flows"], M: ["lahars", "Lahars"], L: ["lava flows", "Lava Flows"], W: ["the tsunami", "Tsunami"],
  T: ["ash fall", "Ash Fall"], G: ["volcanic gases", "Volcanic Gases"], I: ["the famine and disease that followed", "Famine and Disease"], S: ["earthquakes", "Earthquakes"],
  A: ["a debris avalanche", "Debris Avalanche"], F: ["floods", "Floods"], E: ["lightning", "Lightning"] };
const liste = (l) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} and ${l.at(-1)}`);
const FRONTIERE = { SUB: "a subduction zone", OCB: "a collision zone", CCB: "a continental collision zone", OSR: "a mid-ocean ridge", CRB: "a continental rift", OTF: "an oceanic transform fault", CTF: "a continental transform fault" };

// Sounds of the hook and of some scenes: [file, volume, seconds]
const SONS = {
  volcan: [["sons/explosion.mp3", 0.9, 5], ["sons/grondement-volcan.mp3", 0.45, 12]],
  seisme: [["sons/seisme-ouverture.mp3", 0.9, 4], ["sons/seisme-grondement.mp3", 0.4, 9]],
  chiffres: [["sons/impact.wav", 0.35, 2.2]],
  repliques: [["sons/sismographe.mp3", 0.3, 4]],
  lave: [["sons/lave.mp3", 0.3, 8]],
};

// Shaking of a past earthquake (user request of Nov 5, 2026, like the ShakeMap of the alert reels): the USGS event within 2 min
// and 150 km of the NCEI time, its ShakeMap intensity contours and the PAGER cities, written to public/evenements/<dossier>/secousses.json
const MOT_MMI = { 4: "light", 5: "moderate", 6: "strong", 7: "very strong", 8: "severe", 9: "violent", 10: "extreme" };
async function secousses(t, lat, lon, mag, dossier) {
  const q = await json(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${new Date(t - 120e3).toISOString()}&endtime=${new Date(t + 120e3).toISOString()}&latitude=${lat}&longitude=${lon}&maxradiuskm=150&minmagnitude=${mag - 0.7}`);
  const ev = q.features.sort((a, b) => b.properties.mag - a.properties.mag)[0]; if (!ev) return null;
  const p = (await json(`https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${ev.id}&format=geojson`)).properties.products;
  const url = (prod, fic) => p[prod]?.[0]?.contents?.[fic]?.url, uc = url("shakemap", "download/cont_mmi.json"); if (!uc) return null;
  const r2 = (a) => (Array.isArray(a[0]) ? a.map(r2) : [Math.round(a[0] * 100) / 100, Math.round(a[1] * 100) / 100]);
  const cont = (await json(uc)).features.filter((x) => x.properties.value >= 4).map((x) => ({ type: "Feature", properties: { mmi: Math.round(x.properties.value) }, geometry: { type: x.geometry.type, coordinates: r2(x.geometry.coordinates) } }));
  const uv = url("losspager", "json/cities.json"), v = uv ? await json(uv).catch(() => null) : null;
  // The largest town where the shaking was strongest, then the largest city of the list (often the capital), then the others
  const toutes = v ? [...(v.onepager_cities ?? []), ...(v.all_cities ?? [])].filter((c, i, a) => a.findIndex((x) => x.name === c.name) === i).map((c) => ({ ...c, mmi: Math.round(c.mmi) })) : [];
  const fort = [...toutes].sort((a, b) => b.mmi - a.mmi || b.pop - a.pop)[0], grande = [...toutes].sort((a, b) => b.pop - a.pop)[0];
  const villes = [...new Set([fort, grande, ...[...toutes].sort((a, b) => b.mmi - a.mmi || b.pop - a.pop)].filter(Boolean))].slice(0, 4)
    .map((c) => ({ nom: c.name, lon: c.lon, lat: c.lat, mmi: c.mmi }));
  if (!cont.length) return null;
  ecrireJson(join(RACINE, "public", "evenements", dossier, "secousses.json"), { cont, villes }, false);
  const max = Math.max(...cont.map((x) => x.properties.mmi)), lons = [], lats = [];
  const points = (a) => (Array.isArray(a[0]) ? a.forEach(points) : (lons.push(a[0]), lats.push(a[1])));
  for (const x of cont.filter((x) => x.properties.mmi >= 5)) points(x.geometry.coordinates);
  const etendue = lons.length ? Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats)) : 3;
  return { max, villes, etendue };
}

let H = null;
const histoire = () => (H ??= lireJson("donnees", "histoire.json"));

// Photo scene, or null: the file must name the year when the scene is about one eruption or one quake
async function scenePhoto(dossier, nom, requetes, annee, options = {}) {
  // The first file that downloads and passes the photo check (src/medias.mjs), at most 6 tries
  const vus = new Set(); let essais = 0;
  for (const q of requetes) for (const f of await chercher(q, options)) {
    if (vus.has(f.titre) || (annee != null && !f.titre.includes(String(annee))) || essais++ >= 6) continue;
    vus.add(f.titre); const m = await telecharger(f, dossier, nom); if (m) return m;
  }
  return null;
}
const photoSite = (h, dossier) => (h.photo ? telecharger({ ...h.photo, titre: h.photo.page.split("File:")[1] ?? "", mime: "image/jpeg", vignette: h.photo.url }, dossier, "media-1") : null);
const credit = (m) => (m ? `${m.video ? "Video" : "Photo"}: ${m.credit.replace(/^(.+) \1/, "$1")}` : null);

// Eruption list of a volcano on the time line, with its deadly eruptions and the one of the post
function frise(h, annee, depuis) {
  const morts = Object.fromEntries((h.ncei ?? []).filter((e) => e[4]).map((e) => [e[0], e[4]]));
  const pts = (h.gvp ?? []).map(([a, vei]) => [a, vei, morts[a] ?? null, a === annee]);
  if (annee != null && !pts.some((p) => p[0] === annee)) pts.push([annee, null, morts[annee] ?? null, true]);
  pts.sort((a, b) => a[0] - b[0]);
  const a0 = Math.floor(Math.min(depuis, ...pts.map((p) => p[0])) / 50) * 50, a1 = new Date().getUTCFullYear(), pas = a1 - a0 > 300 ? 100 : 50;
  const graduations = []; for (let a = Math.ceil(a0 / pas) * pas; a <= a1; a += pas) graduations.push(a);
  return { pts: pts.filter((p) => p[0] >= a0), bornes: [a0, a1], graduations };
}

// ---------- Volcano On This Day ----------
// e: line of donnees/ce-jour.json [month-day, year, name, country, VEI, deaths, slug, lon, lat, type, GVP number]
export async function histoireVolcanCeJour(e, dossier, quand) {
  const [, annee, nom, pays, vei, morts, slug, , , type, gvp] = e, h = histoire().volcans[gvp] ?? {}, court = nom.replace(/\s*\(.*\)$/, "").replace(/^Mount /, "Mount ");
  const ev = (h.ncei ?? []).find((x) => x[6] === slug), causes = (ev?.[5] ?? []).filter((c) => CAUSES[c]), taille = TAILLE(vei), scenes = [], sources = [];
  // 1. Hook: a picture of that eruption, else the photo of the volcano page of the site, else a Commons search (loose, so last:
  // "Sakurajima eruption" first returned a rock in a garden)
  const m1 = await scenePhoto(dossier, "media-1", [`${court} ${annee}`, `${court} ${annee} eruption`], annee) ?? await photoSite(h, dossier)
    ?? await scenePhoto(dossier, "media-1", [`${court} eruption`], null);
  const accroche = `On ${quand}, ${court} erupted in ${le(pays)}.${morts ? ` It killed ${gens(morts)}.` : ""}`;
  if (m1) { scenes.push({ type: "media", fichier: m1.fichier, video: m1.video, sur: "On This Day", grand: an(annee), titre: nom, sous: `${quand} · ${pays}`, credit: credit(m1), sons: SONS.volcan, texte: accroche }); sources.push(m1); }
  else scenes.push({ type: "accroche", sons: SONS.volcan, texte: accroche });
  // 2. Where it is
  const faits = [...(h.alt ? [[`${nf.format(pieds(h.alt))} ft`, `Elevation (${nf.format(h.alt)} m)`]] : []), ...(h.pop30 ? [[plusDe(h.pop30).replace("more than ", "") + (plusDe(h.pop30).startsWith("more") ? "+" : ""), "People Within 19 Miles Today"]] : []), ...(type ? [[type, "Volcano Type"]] : [])];
  scenes.push({ type: "lieu", faits, texte: [h.alt ? `It rises ${nf.format(pieds(h.alt))} feet.` : null, h.pop30 ? `Today, ${plusDe(h.pop30)} people live within 19 miles of it.` : null].filter(Boolean).join(" ") || `Here is where it happened, in ${le(pays)}.` });
  // 3. The eruption in figures
  if (morts || taille) scenes.push({ type: "chiffres", sur: `The ${an(annee)} Eruption`, items: [...(morts ? [[morts, morts === 1 ? "Death" : "Deaths"]] : []), ...(taille ? [[taille, "Eruption Size"]] : [])], puces: causes.map((c) => CAUSES[c][1]), sons: SONS.chiffres,
    texte: [taille ? `It was a ${taille.toLowerCase()} eruption.` : null, morts && causes.length ? `Most deaths came from ${liste(causes.map((c) => CAUSES[c][0]))}.` : null].filter(Boolean).join(" ") });
  // 4. Its worst disaster since (else before), with a photo of it when one exists
  const autres = (h.ncei ?? []).filter((x) => x[4] && x[6] !== slug), apres = autres.filter((x) => x[0] > annee), pire = (l) => l.sort((a, b) => b[4] - a[4])[0];
  const autre = pire(apres) ?? pire(autres.filter((x) => x[4] > (morts ?? 0)));
  if (autre) {
    const [ya, , , , ma, ca] = autre, texte = `${ya > annee ? `Its deadliest eruption since came in ${an(ya)}` : `Its deadliest eruption came earlier, in ${an(ya)}`}: ${gens(ma)} died${(ca ?? []).filter((c) => CAUSES[c]).length ? `, mainly from ${liste(ca.filter((c) => CAUSES[c]).slice(0, 2).map((c) => CAUSES[c][0]))}` : ""}.`;
    const m = await scenePhoto(dossier, "media-2", [`${court} ${ya} eruption`, `${court} ${ya}`], ya);
    if (m) { scenes.push({ type: "media", fichier: m.fichier, video: m.video, sur: ya > annee ? "Since Then" : "Its Worst", grand: an(ya), titre: `${nf.format(ma)} ${ma === 1 ? "Death" : "Deaths"}`, sous: nom, credit: credit(m), sons: SONS.lave, texte }); sources.push(m); }
    else scenes.push({ type: "chiffres", sur: ya > annee ? "Since Then" : "Its Worst", items: [[an(ya), "Eruption"], [ma, ma === 1 ? "Death" : "Deaths"]], puces: (ca ?? []).filter((c) => CAUSES[c]).map((c) => CAUSES[c][1]), sons: SONS.chiffres, texte });
  }
  // 5. Every eruption since, on a time line
  if ((h.gvp ?? []).length >= 3) {
    const f = frise(h, annee, Math.min(annee, 1700)), apresN = (h.gvp ?? []).filter(([a]) => a > annee), der = (h.gvp ?? []).at(-1)?.[0];
    const etiquettes = [[annee, an(annee), 330], ...(autre && autre[0] !== annee ? [[autre[0], `${an(autre[0])} · ${nf.format(autre[4])} dead`, 430]] : []), ...(der && der !== annee && der !== autre?.[0] ? [[der, `Latest: ${der}`, 250]] : [])];
    scenes.push({ type: "frise", sur: "Every Eruption", titre: `${court} Since ${an(f.bornes[0])}`, sous: "Smithsonian Global Volcanism Program", points: f.pts, bornes: f.bornes, graduations: f.graduations, etiquettes, compte: `Eruptions Since ${an(annee)}`,
      texte: apresN.length ? `Since ${an(annee)}, it has erupted ${apresN.length === 1 ? "once more" : `${apresN.length} more times`}. The latest eruption began in ${der}.` : `It has not erupted since.` });
    scenes.at(-1).depuisAn = annee; // the counter shows the eruptions after the one of the post
  }
  return { scenes, sources, musique: "musique/tension-eruptions.mp3" };
}

// ---------- Volcano Spotlight ----------
// p: post of spotlight() (src/rubriques.mjs), gvp: Smithsonian number of the volcano
export async function histoireSpotlight(p, gvp, court, pays) {
  const h = histoire().volcans[gvp] ?? {}, scenes = [], sources = [], dossier = p.dossier;
  // 1. Hook: a video of an eruption (satellite loops of NOAA/CIRA, field videos), else a photo
  const m1 = await scenePhoto(dossier, "media-1", [`${court} eruption`], null, { video: true }) ?? await photoSite(h, dossier) ?? await scenePhoto(dossier, "media-1", [`${court} eruption`], null);
  const accroche = p.reel.accroche + (p.reel.etat ? ` ${p.reel.etat}` : "");
  if (m1) { scenes.push({ type: "media", fichier: m1.fichier, video: m1.video, sur: "Volcano Spotlight", grand: court, titre: p.ecran.ligne2 ?? pays, sous: pays, credit: credit(m1), sons: SONS.volcan, texte: accroche }); sources.push(m1); }
  else scenes.push({ type: "accroche", sons: SONS.volcan, texte: accroche });
  // 2. Where it is, with its alert levels
  scenes.push({ type: "lieu", texte: [h.alt ? `It rises ${nf.format(pieds(h.alt))} feet.` : null, h.pop30 ? `${plusDe(h.pop30)[0].toUpperCase() + plusDe(h.pop30).slice(1)} people live within 19 miles.` : null, p.reel.lieu].filter(Boolean).join(" ") });
  // 3. Every eruption since 1500
  const depuis = (h.gvp ?? []).filter(([a]) => a >= 1500);
  if (depuis.length >= 3) {
    const f = frise(h, null, 1500), mortelles = (h.ncei ?? []).filter((x) => x[4] && x[0] >= 1500).length, pireE = [...(h.ncei ?? [])].filter((x) => x[4]).sort((a, b) => b[4] - a[4])[0];
    scenes.push({ type: "frise", sur: "Every Eruption", titre: `${court} Since 1500`, sous: "Smithsonian Global Volcanism Program", points: f.pts.map((x) => [...x.slice(0, 3), false]), bornes: f.bornes, graduations: f.graduations,
      etiquettes: [...(pireE && pireE[0] >= 1500 ? [[pireE[0], `${pireE[0]} · ${nf.format(pireE[4])} dead`, 430]] : []), [depuis.at(-1)[0], `Latest: ${depuis.at(-1)[0]}`, 250]], compte: "Eruptions Since 1500",
      texte: `Since 1500, it has erupted ${depuis.length} times${mortelles ? `, and ${mortelles === 1 ? "one of those eruptions was" : `${mortelles} of them were`} deadly` : ""}.` });
  }
  // 4. Its deadliest eruption
  const pire = [...(h.ncei ?? [])].filter((x) => x[4]).sort((a, b) => b[4] - a[4])[0];
  if (pire) {
    const [ya, , , vei, ma, ca] = pire, cs = (ca ?? []).filter((c) => CAUSES[c]), texte = `Its deadliest eruption came in ${an(ya)}: ${gens(ma)} died${cs.length ? `, mainly from ${liste(cs.slice(0, 2).map((c) => CAUSES[c][0]))}` : ""}.`;
    const m = await scenePhoto(dossier, "media-2", [`${court} ${ya} eruption`, `${court} ${ya}`], ya);
    if (m) { scenes.push({ type: "media", fichier: m.fichier, video: m.video, sur: "Its Deadliest", grand: an(ya), titre: `${nf.format(ma)} ${ma === 1 ? "Death" : "Deaths"}`, sous: court, credit: credit(m), sons: SONS.lave, texte }); sources.push(m); }
    else scenes.push({ type: "chiffres", sur: "Its Deadliest", items: [[an(ya), TAILLE(vei) ? `${TAILLE(vei)} Eruption` : "Eruption"], [ma, ma === 1 ? "Death" : "Deaths"]], puces: cs.map((c) => CAUSES[c][1]), sons: SONS.chiffres, texte });
  }
  return { scenes, sources, musique: "musique/volcan-documentaire.mp3" };
}

// ---------- Earthquake On This Day ----------
// s: line of donnees/ce-jour.json [month-day, year, magnitude, name, country, deaths, slug, lon, lat, tsunami, depth km]
export async function histoireSeismeCeJour(s, dossier, nom, quand) {
  const [md, annee, mag, , pays, morts, slug, lon, lat, tsunami, prof] = s, h = histoire().seismes[slug] ?? {}, scenes = [], sources = [];
  // 1. Hook: a photo of that earthquake (its Wikidata image, else Commons), the year in the file name
  const wd = h.wd ? await imageWikidata(h.wd) : null;
  const m1 = (wd && (wd.titre.includes(String(annee)) || /earthquake|quake|terremoto|sismo|séisme|damage/i.test(wd.titre)) ? await telecharger(wd, dossier, "media-1") : null)
    ?? await scenePhoto(dossier, "media-1", [`${annee} ${pays} earthquake`, `${pays} earthquake ${annee}`, `${annee} earthquake ${h.lieu?.split(",")[0] ?? pays}`], annee);
  const accroche = `On this day in ${annee}, a magnitude ${mag.toFixed(1)} earthquake struck ${le(pays)}.`;
  if (m1) { scenes.push({ type: "media", fichier: m1.fichier, video: m1.video, sur: "On This Day", grand: `M${mag.toFixed(1)}`, titre: nom, sous: quand, credit: credit(m1), sons: SONS.seisme, texte: accroche }); sources.push(m1); }
  else scenes.push({ type: "accroche", sons: SONS.seisme, texte: accroche });
  // 2. Where: place, depth, plates
  const ou = h.plaque ? `It struck on the ${h.plaque}${h.autre ? `, ${nf.format(Math.round(h.km / 1.609344))} miles from its boundary with the ${h.autre}${FRONTIERE[h.classe] ? `, ${FRONTIERE[h.classe]}` : ""}` : ""}.` : null;
  scenes.push({ type: "lieu", faits: [[`M${mag.toFixed(1)}`, "Magnitude"], ...(prof ? [[`${Math.round(prof / 1.609344)} mi`, `Depth (${prof} km)`]] : []), ...(tsunami ? [["Tsunami", "Followed"]] : [])],
    texte: [h.lieu ? `The epicenter was near ${h.lieu.split(",")[0]}${prof ? `, ${Math.round(prof / 1.609344)} miles deep` : ""}.` : prof ? `It started ${Math.round(prof / 1.609344)} miles deep.` : null, ou].filter(Boolean).join(" ") || "Here is where it struck." });
  // 2b. The shaking (USGS ShakeMap), from 1900 when one exists
  try {
    const t0 = Date.UTC(annee, +md.slice(0, 2) - 1, +md.slice(3), ...(h.heure ?? [0, 0]));
    const sm = h.heure ? await secousses(t0, lat, lon, mag, dossier) : null;
    if (sm && sm.max >= 5) {
      const [v1, v2] = sm.villes.filter((v) => MOT_MMI[v.mmi]);
      scenes.push({ type: "secousses", sur: "The Shaking", mot: MOT_MMI[Math.min(10, sm.max)], mmi: Math.min(10, sm.max), villes: sm.villes, R: Math.max(1600, Math.min(9000, 520 / (sm.etendue * Math.PI / 180))), sons: SONS.seisme.slice(1),
        texte: !v1 ? `The shaking reached ${MOT_MMI[Math.min(10, sm.max)]} intensity.` : v1.mmi >= Math.min(10, sm.max) ? `The shaking was ${MOT_MMI[v1.mmi]} in ${v1.nom}${v2 ? `, and ${v2.mmi === v1.mmi ? "also" : MOT_MMI[v2.mmi]} in ${v2.nom}` : ""}.`
          : `The shaking reached ${MOT_MMI[Math.min(10, sm.max)]} intensity. In ${v1.nom}, it was ${MOT_MMI[v1.mmi]}.` });
    }
  } catch (e) { console.log("Secousses indisponibles :", e.message); }
  // 3. The toll
  const bilan = [[morts, morts === 1 ? "Death" : "Deaths"], [h.blesses, "Injured"], [h.detruites, "Homes Destroyed"]].filter(([n]) => n);
  if (bilan.length) scenes.push({ type: "chiffres", sur: "The Toll", items: bilan, puces: [...(tsunami ? ["Tsunami"] : []), ...(h.endommagees ? [`${nf.format(h.endommagees)} Homes Damaged`] : []), ...(h.degats ? [`$${nf.format(h.degats)} Million in Damage`] : [])], sons: SONS.chiffres,
    texte: `It ${liste([morts ? `killed ${gens(morts)}` : null, h.blesses ? `injured ${nf.format(h.blesses)}` : null, h.detruites ? `destroyed ${nf.format(h.detruites)} homes` : null].filter(Boolean))}.${tsunami ? " A tsunami followed." : ""}` });
  // 4. The aftershocks of the next 30 days (USGS catalog, M4+, from 1973 when it is complete enough), and the strongest quake since
  if (annee >= 1973) try {
    const t0 = Date.UTC(annee, +md.slice(0, 2) - 1, +md.slice(3), ...(h.heure ?? [0, 0])), rayon = mag >= 7.5 ? 300 : mag >= 7 ? 200 : 120;
    const q = (de, a, min, tri = "time-asc") => json(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${new Date(de).toISOString()}&endtime=${new Date(a).toISOString()}&latitude=${lat}&longitude=${lon}&maxradiuskm=${rayon}&minmagnitude=${min}&orderby=${tri}&limit=2000`);
    const f = (await q(t0 - 3600e3, t0 + 30 * 86400e3, 4)).features;
    // The mainshock is the strongest quake within an hour of the NCEI time
    const choc = f.filter((x) => Math.abs(x.properties.time - t0) < 3600e3).sort((a, b) => b.properties.mag - a.properties.mag)[0], t = choc?.properties.time ?? t0;
    const pts = f.filter((x) => x !== choc && x.properties.time > t).map((x) => [x.geometry.coordinates[0], x.geometry.coordinates[1], x.properties.mag, (x.properties.time - t) / 86400e3]);
    const fort = (await q(t + 30 * 86400e3, Date.now(), Math.max(6, mag - 1), "magnitude")).features[0];
    if (pts.length >= 5) scenes.push({ type: "repliques", sur: "The Next 30 Days", titre: "Quakes M4+ Nearby", jours: 30, points: pts, R: rayon >= 300 ? 1500 : rayon >= 200 ? 2000 : 2600, sons: SONS.repliques,
      ...(fort ? { depuis: { lon: fort.geometry.coordinates[0], lat: fort.geometry.coordinates[1], titre: `M${fort.properties.mag.toFixed(1)}`, ligne: new Date(fort.properties.time).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) } } : {}),
      texte: `In the next 30 days, ${pts.length} more quakes of magnitude 4 or more shook the area.${fort ? ` The strongest one nearby since then was a magnitude ${fort.properties.mag.toFixed(1)}, in ${new Date(fort.properties.time).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}.` : ""}` });
  } catch (e) { console.log("Répliques indisponibles :", e.message); }
  return { scenes, sources, musique: "musique/seisme-documentaire.mp3" };
}

// Photos of an On This Day image post (carousel after the map, user request of Nov 5, 2026): up to n distinct free photos whose
// file name gives the year of the event, so they show that event and not another one. Earthquakes: their Wikidata image first.
export async function photosCeJour(type, ligne, dossier, n = 2) {
  const [, annee] = ligne, h = type === "seisme" ? histoire().seismes[ligne[6]] ?? {} : {}, pris = [], vus = new Set();
  const requetes = type === "seisme" ? [`${annee} ${ligne[4]} earthquake`, `${ligne[4]} earthquake ${annee}`, ...(h.lieu ? [`${annee} earthquake ${h.lieu.split(",")[0]}`] : [])]
    : [`${ligne[2].replace(/\s*\(.*\)$/, "")} ${annee} eruption`, `${ligne[2].replace(/\s*\(.*\)$/, "")} ${annee}`];
  const candidats = [];
  if (h.wd) { const w = await imageWikidata(h.wd); if (w) candidats.push(w); }
  for (const q of requetes) candidats.push(...(await chercher(q)));
  for (const f of candidats) {
    if (pris.length >= n || vus.size >= 8) break;
    // Two shots of one series ("Terremoto 2012 en San Marcos, Guatemala. 10.JPG" and "… 11.JPG") count as one
    const serie = f.titre.replace(/\.[a-z]+$/i, "").replace(/[\d\s._()-]+$/, "");
    if (vus.has(serie) || !f.titre.includes(String(annee))) continue;
    vus.add(serie);
    const m = await telecharger(f, dossier, `photo-${pris.length + 1}`); if (m) pris.push(m);
  }
  return pris;
}
