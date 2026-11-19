// One reel for several earthquakes that had no reel of their own (user request of Nov 19, 2026: four M6+ quakes at sea had no
// reel between Nov 5 and Nov 18, because the reel then needed a PAGER city). Hook on the globe with every quake, one scene per quake
// (its map, or its USGS ShakeMap when the shaking reached intensity IV), end card. Every figure comes from the USGS event page.
// By hand: node src/principal.mjs rattrapage:<id>,<id>,…  (the workflow publishes it like a reel, networks "reel")
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ajusterX, json, nf, RACINE } from "./commun.mjs";
import { secousses } from "./histoires.mjs";
import { reelLieu } from "./rendre.mjs";

const MOT = { 2: "weak", 3: "weak", 4: "light", 5: "moderate", 6: "strong", 7: "very strong", 8: "severe", 9: "violent", 10: "extreme" };
const MOIS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const mi = (km) => Math.round(km / 1.609344);
// "148 km WSW of Tual, Indonesia" → "92 miles west-southwest of Tual, Indonesia"; regions stay as they are
const DIRS = { N: "north", S: "south", E: "east", W: "west" };
const dir = (c) => (c.length === 1 ? DIRS[c] : c.length === 2 ? DIRS[c[0]] + DIRS[c[1]] : `${DIRS[c[0]]}-${DIRS[c[1]]}${DIRS[c[2]]}`); // SE southeast, WSW west-southwest
const lieuDit = (place) => { const m = place.match(/^(\d+) km ([NSEW]{1,3}) of (.+)$/); return m ? `${mi(+m[1])} miles ${dir(m[2])} of ${m[3]}` : / region$/.test(place) ? `in the ${place}` : `on the ${place}`; };
const court = (place) => { const m = place.match(/^\d+ km [NSEW]{1,3} of (.+)$/); return (m ? `Near ${m[1]}` : place).replace(/ region$/, ""); };

export async function rattrapage(ids) {
  const ev = [];
  for (const id of ids) {
    const j = await json(`https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${id}&format=geojson`), p = j.properties, [lon, lat, prof] = j.geometry.coordinates;
    ev.push({ id, mag: Math.round(p.mag * 10) / 10, place: p.place, time: p.time, lon, lat, prof, felt: p.felt ?? 0, alert: p.alert, tsunami: p.tsunami });
  }
  ev.sort((a, b) => a.time - b.time);
  const id = `rattrapage-${new Date(ev.at(-1).time).toISOString().slice(0, 10)}`, quand = (t) => `${MOIS[new Date(t).getUTCMonth()]} ${new Date(t).getUTCDate()}`;
  const fort = ev.reduce((a, b) => (b.mag > a.mag ? b : a)), mer = ev.every((e) => !/, [A-Z]/.test(e.place) || / of /.test(e.place));
  const scenes = [{ type: "accroche", points: ev.map((e) => [e.lon, e.lat]), sons: [["sons/seisme-ouverture.mp3", 0.9, 4], ["sons/seisme-grondement.mp3", 0.4, 9]],
    texte: `${["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][ev.length]} strong earthquakes you may have missed${mer ? ", all at sea" : ""}.` }];
  for (const e of ev) {
    const sm = await secousses(e.time, e.lat, e.lon, e.mag, `rattrapage-${e.id}`).catch(() => null);
    const ou = { lon: e.lon, lat: e.lat, nom: `M${e.mag.toFixed(1)} ${court(e.place)}`, coords: `${Math.abs(e.lat).toFixed(2)}°${e.lat >= 0 ? "N" : "S"} ${Math.abs(e.lon).toFixed(2)}°${e.lon >= 0 ? "E" : "W"}`,
      ligneDate: `${quand(e.time)}, ${new Date(e.time).getUTCFullYear()}`,
      faits: [[`M${e.mag.toFixed(1)}`, "Magnitude"], [`${mi(e.prof)} mi`, `Depth (${Math.round(e.prof)} km)`], [nf.format(e.felt), e.felt === 1 ? "Felt Report" : "Felt Reports"]] };
    const ressenti = e.felt === 0 ? "No one reported feeling it." : e.prof > 300 ? `It struck ${mi(e.prof)} miles deep, so deep that only ${e.felt === 1 ? "one person" : `${nf.format(e.felt)} people`} felt it.`
      : `${nf.format(e.felt)} ${e.felt === 1 ? "person" : "people"} reported feeling it.`;
    const debut = `${quand(e.time)}: ${e === fort ? "the strongest, " : ""}a magnitude ${e.mag.toFixed(1)}, ${lieuDit(e.place)}.`;
    const ride = /Ridge|Rise/.test(e.place) ? " Two plates pull apart there." : "";
    if (sm && sm.max >= 4) scenes.push({ type: "secousses", ou, secousses: `evenements/rattrapage-${e.id}/secousses.json`, sur: quand(e.time), mot: MOT[Math.min(10, sm.max)], mmi: Math.min(10, sm.max), villes: sm.villes,
      R: Math.max(2200, Math.min(12000, 1300 / (sm.etendue * Math.PI / 180))), titre: "Estimated Shaking, USGS",
      texte: `${debut}${ride} The USGS estimates ${MOT[Math.min(10, sm.max)]} shaking at sea${e.felt === 0 ? ", but no one reported feeling it" : ""}.` });
    else scenes.push({ type: "lieu", ou, sur: quand(e.time), R: 2200, texte: `${debut}${ride} ${ressenti}` });
  }
  const verts = ev.every((e) => e.alert === "green");
  scenes.push({ type: "fin", texte: `${verts ? "Little or no damage expected for all of them. " : ""}Follow every quake live, link in bio.` });

  const d = { compte: "seismes", couleur: "#FF6A4D", lon: -175, lat: -10, pastille: "You May Have Missed", nom: `${ev.length} Strong Earthquakes`, sousTitre: mer ? "All at Sea" : null,
    ligneDate: `${quand(ev[0].time)} – ${quand(ev.at(-1).time)}`, coords: "", faits: [], satLigne: "", date: "" };
  mkdirSync(join(RACINE, "public", "evenements", id), { recursive: true });
  writeFileSync(join(RACINE, "public", "evenements", id, "donnees.json"), "{}");
  const sortie = join(RACINE, "sortie", id), fichiers = await reelLieu(id, d, scenes, sortie, "musique/seisme-documentaire.mp3");

  const titre = `🌍 ${ev.length} Strong Earthquakes You May Have Missed`, lignes = ev.map((e) => `🔴 M${e.mag.toFixed(1)}, ${court(e.place)} (${quand(e.time)}), ${mi(e.prof)} mi deep`);
  const tags = ["#Earthquake", "#Earthquakes", "#EarthquakeNews", "#Seismology"], lien = "https://www.liveatlas.earth/earthquakes-today/";
  const corps = [titre, "", ...lignes, "", ...(verts ? ["🟢 All green on the USGS PAGER scale: little or no damage expected", ""] : [])].join("\n");
  const legendes = { x: ajusterX(`${corps}\n👇 Live Map\n${lien}\nSource: USGS\n\n`, tags, []), instagram: `${corps}\n🗺️ Live Map, Link in Bio\nSource: USGS\n\n${tags.join(" ")}`, facebook: `${corps}\n👇 Live Map\n${lien}\nSource: USGS\n\n${tags.slice(0, 4).join(" ")}` };
  const narration = scenes.map((s) => s.texte).join("\n\n");
  writeFileSync(join(sortie, "legendes.json"), JSON.stringify({ type: "seisme", lien, legendes, narration }, null, 1));
  writeFileSync(join(sortie, "reseaux.txt"), "reel");
  writeFileSync(join(sortie, "titre.txt"), `${titre} · Reel (reel)`);
  writeFileSync(join(sortie, "issue.md"), [`**Catch-up reel** · @LiveAtlasQuakes · ${ev.map((e) => e.id).join(", ")}`, "", "### Instagram", "```", legendes.instagram, "```", "", "### Narration", "```", narration, "```", ""].join("\n"));
  return { id, reseaux: ["reel"], fichiers };
}
