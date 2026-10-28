// Texts of one earthquake alert: on-screen texts, captions for X, Instagram and Facebook, and the reel narration.
// Rules (Live Atlas templates, Oct 2026): Title Case labels, miles first then km, local time, no source line, no disclaimer,
// calm wording, nothing that is not in the USGS data.
import { geoContains } from "d3-geo";
import { classe, COMPTES, kmEnMi, lireJson, NOM_MMI, nf, ROMAIN, variante } from "./commun.mjs";
import { auxUSA } from "./detecter.mjs";

const MOTS_LOCAUX = {
  Mexico: ["sismo", "temblor"], Guatemala: ["sismo", "temblor"], "El Salvador": ["sismo", "temblor"], Honduras: ["sismo"], Nicaragua: ["sismo"], "Costa Rica": ["sismo", "temblor"],
  Panama: ["sismo", "temblor"], Colombia: ["sismo", "temblor"], Ecuador: ["sismo"], Peru: ["sismo", "temblor"], Chile: ["sismo", "temblor"], Argentina: ["sismo"], Bolivia: ["sismo"], Venezuela: ["sismo"],
  "Puerto Rico": ["temblor"], "Dominican Republic": ["sismo"], Spain: ["terremoto"], Italy: ["terremoto"], Portugal: ["sismo"],
  Japan: ["地震"], China: ["地震"], Taiwan: ["地震"], Philippines: ["lindol"], Indonesia: ["gempa"], Turkey: ["deprem"], "Türkiye": ["deprem"], Greece: ["σεισμός"],
};
const tag = (s) => "#" + s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
const bas = (s) => s.toLowerCase();

let TERRES = null, PAYS_NE = null;
// Natural Earth subregion → zone hashtag
const ZONES = { Melanesia: "#Pacific", Polynesia: "#Pacific", Micronesia: "#Pacific", "Eastern Africa": "#Africa", "Northern Africa": "#Africa", "Middle Africa": "#Africa", "Southern Africa": "#Africa", "Western Africa": "#Africa",
  "Central Asia": "#CentralAsia", "South-Eastern Asia": "#SoutheastAsia", "South America": "#SouthAmerica", Caribbean: "#Caribbean", "Eastern Europe": "#Europe", "Northern Europe": "#Europe", "Western Europe": "#Europe", "Southern Europe": "#Europe",
  "Central America": "#CentralAmerica", "Western Asia": "#MiddleEast", "Eastern Asia": "#EastAsia", "Southern Asia": "#SouthAsia", "Australia and New Zealand": "#Oceania" };
const surTerre = (lon, lat) => (TERRES ??= lireJson("donnees", "ne_pays_110m.geojson")).features.some((f) => geoContains(f, [lon, lat]));

export function textes(d) {
  const c = classe(d.mag), M = d.mag.toFixed(1), id = d.id;
  const loc = (o) => new Intl.DateTimeFormat("en-US", { timeZone: d.fuseau, ...o }).format(new Date(d.temps));
  const heure = loc({ hour: "numeric", minute: "2-digit" }), mois = loc({ month: "short" }), moisLong = loc({ month: "long" }), jour = loc({ day: "numeric" }), annee = loc({ year: "numeric" });
  const utc = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(d.temps));
  const m = d.lieu.match(/^(\d+) km ([NSEW]{1,3}) of (.+)$/);
  const ref = m ? m[3] : null, ligneLieu = m ? `${kmEnMi(+m[1])} mi (${m[1]} km) ${m[2]} of ${m[3]}` : d.lieu;
  const pres = m ? `near ${ref}` : `in the ${d.lieu.replace(/ region$/, " region")}`;
  const region = ref ?? d.lieu.replace(/ region$/, "");
  const peuProfond = d.prof_km < 70, enMer = !surTerre(d.lon, d.lat);
  const pays = d.pays, usa = auxUSA(d.lieu), lien = COMPTES.seismes.lien_seisme.replace("{id}", id).replace("{lon}", d.lon.toFixed(2)).replace("{lat}", d.lat.toFixed(2));
  const mmiMax = d.mmi_max ? Math.round(d.mmi_max) : null, ville = d.villes[0], mmiVille = ville ? Math.round(ville.mmi) : null;
  const exposes = d.exposes_vi_plus >= 1000 ? Math.round(d.exposes_vi_plus / 1000) * 1000 : null;

  // Hashtags (decided Oct 28, 2026): one #earthquake only (never with #earthquakes), alert, country, zone, city, local word, shaking. No brand tag.
  const zoneTag = ZONES[(PAYS_NE ??= lireJson("donnees", "ne_pays_110m.geojson").features).find((f) => f.properties.NAME === (usa ? "United States of America" : pays))?.properties.SUBREGION];
  const villeTag = ref && ref.split(",")[0].length < 20 && ref.split(",")[0] !== pays ? tag(ref.split(",")[0]) : null;
  const locaux = (MOTS_LOCAUX[pays] ?? []).map((w) => "#" + w);
  const lieux = [...new Set([tag(pays), ...(usa ? ["#USA"] : []), zoneTag, villeTag].filter(Boolean))];
  const hX = [...new Set(["#earthquake", "#EarthquakeAlert", ...lieux, ...locaux.slice(0, 2), "#shaking"])].join(" ");
  const hIG = [...new Set(["#earthquake", "#EarthquakeAlert", ...lieux, ...locaux, "#shaking", "#seismology"])].join(" ");
  const hFB = [...new Set(["#earthquake", tag(pays), ...locaux.slice(0, 1)])].join(" ");

  const titre = `${c.emoji} M${M} Earthquake ${m ? "Near " + ref : "in " + region}`;
  const lignes = [
    `📍 ${ligneLieu}`,
    `🕐 ${heure} Local, ${mois} ${jour}`,
    `⬇️ Depth: ${d.prof_mi} mi (${Math.round(d.prof_km)} km)`,
    ...(mmiMax ? [`📳 Strongest Shaking: ${ROMAIN[mmiMax]} (${NOM_MMI[mmiMax]})`] : []),
  ];
  const long = [
    `📏 Magnitude: ${M} (${c.nom})`,
    `📍 Location: ${ligneLieu}`,
    `📅 Date: ${moisLong} ${jour}, ${annee}`,
    `🕐 Time: ${heure} Local (${utc} UTC)`,
    `⬇️ Depth: ${d.prof_mi} mi (${Math.round(d.prof_km)} km)`,
    ...(mmiMax ? [`📳 Strongest Shaking: ${ROMAIN[mmiMax]} (${NOM_MMI[mmiMax]})`] : []),
    ...(exposes ? [`👥 Strong Shaking or More: About ${nf.format(exposes)} People`] : []),
    ...(ville && mmiVille >= 2 ? [`🏙️ Nearest City: ${ville.nom}, ${ville.mi} mi (${ville.km} km) ${ville.dir}, ${NOM_MMI[mmiVille]} Shaking (${ROMAIN[mmiVille]})`] : []),
    ...(d.ressenti ? [`🙋 Felt Reports: ${nf.format(d.ressenti)}`] : []),
    ...(d.pager ? [`📊 USGS Impact Level: ${d.pager[0].toUpperCase() + d.pager.slice(1)}`] : []),
  ];
  const contexte = d.mag >= 6 ? "\n\nAftershocks are common after a quake this size." : "";
  const legendes = {
    x: `${titre}\n\n${lignes.join("\n")}\n\n👇 Live Map\n${lien}\n\n${hX}`,
    instagram: `${titre}\n\n${long.join("\n")}${contexte}\n\n🗺️ Live Map, Link in Bio\n\n${hIG}`,
    facebook: `${titre}\n\n${long.join("\n")}${contexte}\n\n👇 Live Map\n${lien}\n\n${hFB}`,
  };

  // Narration: 6 paragraphs, one per reel scene (hook, essentials, satellite, shaking, what to do, end)
  const date = `${moisLong} ${jour}`;
  const p1 = variante(id, "p1", [`On ${date}, a magnitude ${M} earthquake struck ${pres}.`, `A magnitude ${M} earthquake struck ${pres} on ${date}.`, `A magnitude ${M} earthquake shook ${pres} on ${date}, at ${heure} local time.`]);
  const prof = peuProfond ? variante(id, "pr", ["It was shallow", "It was a shallow quake"]) : d.prof_km > 300 ? `It struck very deep, about ${d.prof_mi} miles down` : `It struck about ${d.prof_mi} miles underground`;
  const p2 = exposes ? `${prof}, and the USGS estimates that around ${nf.format(exposes)} people felt strong shaking.` : d.ressenti ? `${prof}, and ${nf.format(d.ressenti)} people reported feeling it.` : `${prof}.`;
  const p3 = d.satellite.jour ? "Here is the area from space, the next day." : variante(id, "p3", ["Here is the area, seen from space.", "This is the region, seen from space."]);
  const p4 = mmiMax && ville && mmiVille >= 2 && mmiVille < mmiMax ? `Shaking was ${bas(NOM_MMI[mmiMax])} near the epicenter, and ${bas(NOM_MMI[mmiVille])} in ${ville.nom}, the nearest city.`
    : mmiMax ? `Near the epicenter, the shaking was rated ${bas(NOM_MMI[mmiMax])}.` : `Here is where it struck, on the live map.`;
  const conseil = enMer && peuProfond && d.mag >= 7 ? { cas: "cote", texte: "If you are near the coast and feel strong or long shaking, move to higher ground right away. You don't need to wait for a warning." }
    : { cas: "repliques", texte: "Aftershocks are common. If you feel one, drop, cover, and hold on." };
  const p6 = variante(id, "p6", ["Follow every aftershock live on Live Atlas.", "You can follow it live on Live Atlas.", "Live Atlas keeps tracking it on the live map."]);
  const narration = `[calm] ${p1}\n\n${p2}\n\n${p3}\n\n${p4}\n\n${conseil.texte}\n\n${p6}\n`;

  // On-screen texts for the Remotion compositions
  const lignesSecousse = [];
  for (const niv of [10, 9, 8, 7, 6]) { const n = d.exposition[niv - 1]; if (n > 0) lignesSecousse.push([`${nf.format(n)} People`, `${ROMAIN[niv]} ${NOM_MMI[niv]}`, niv]); }
  if (ville && mmiVille >= 2) lignesSecousse.push([`${ville.nom}, ${ville.mi} mi (${ville.km} km) ${ville.dir}`, `${ROMAIN[mmiVille]} ${NOM_MMI[mmiVille]}`, mmiVille]);
  const ecran = {
    classe: c.nom, couleur: c.couleur, mag: d.mag, region, zone: null, lieuFiche: ref ?? region, lieuLigne: ligneLieu,
    coords: `${Math.abs(d.lat).toFixed(2)}°${d.lat >= 0 ? "N" : "S"} ${Math.abs(d.lon).toFixed(2)}°${d.lon >= 0 ? "E" : "W"}`,
    date: `${mois} ${jour}`, dateLongue: `${mois} ${jour}, ${annee}`, heure, profMi: d.prof_mi, profKm: Math.round(d.prof_km), exposes: exposes ?? 0,
    ressenti: d.ressenti ?? 0, pager: d.pager ?? null, mmiMax, satFichier: d.satellite.fichier,
    satTitre: d.satellite.jour ? ["The Day ", "After"] : ["From ", "Space"], satLigne: d.satellite.jour ? `NASA Terra Satellite, ${new Date(d.satellite.jour + "T00:00:00Z").toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : "NASA Satellite View",
    lignes: lignesSecousse.slice(0, 4), conseil: conseil.cas,
  };
  return { ecran, legendes, narration, lien };
}
