// Weekly reel "This Week in Earthquakes" for @LiveAtlasQuakes (template validated Oct 28, 2026, "Weekly Quake Reel" mockup).
// Every Wednesday at 12:00 PM New York time, on the 7 UTC days from Wednesday to Tuesday, USGS catalog M4.5+ worldwide.
// Scenes: hook (count), count by magnitude class, strongest, busiest spot, then deepest or most felt (alternating weeks,
// both when the most felt has 1,000+ "Did You Feel It?" reports, deepest when it has fewer than 100), end card.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { geoDistance } from "d3-geo";
import { ajusterX, DIRIGE, json, kmEnMi, lireJson, nf, nomPropre, RACINE, titreLieu, variante } from "./commun.mjs";

const HASHTAGS = lireJson("config", "hashtags.json").seismes;
const ETATS_US = { CA: "California", NV: "Nevada", OR: "Oregon", WA: "Washington", UT: "Utah", ID: "Idaho", MT: "Montana", WY: "Wyoming", NM: "New Mexico", AZ: "Arizona", TX: "Texas", OK: "Oklahoma", HI: "Hawaii", AK: "Alaska", CO: "Colorado", KS: "Kansas" };

// New York local date, weekday and hour (DST handled by the time zone database)
const newYork = (ms) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, jour: p.weekday, heure: +p.hour };
};
// Due on Wednesday from 12:00 PM New York time until the end of that day, once per week (etat._hebdo = date of the last one)
export const hebdoDu = (etat, maintenant = Date.now()) => { const n = newYork(maintenant); return n.jour === "Wed" && n.heure >= 12 && etat._hebdo !== n.date ? n.date : null; };

// Region of a USGS place: "191 km ENE of Nagqu, China" → China ; "Bonin Islands, Japan region" → Japan ; "10 km N of X, CA" → California ;
// "southeast of Easter Island" → Easter Island
const region = (place = "") => { const r = nomPropre(place.split(", ").at(-1).replace(/ region$/, "")); return ETATS_US[r] ?? r; };
// Readable place: "191 km ENE of Nagqu, China" → "Near Nagqu, China" ; "southeast of Easter Island" → "Southeast of Easter Island"
const lieu = (place = "") => { const m = place.match(/^\d+ km [NSEW]{1,3} of (.+)$/); const l = (m ? m[1] : titreLieu(place)).replace(/ region$/, ""); const p = l.split(", "); if (ETATS_US[p.at(-1)]) p[p.length - 1] = ETATS_US[p.at(-1)]; return (m ? "Near " : "") + p.join(", "); };
const ville = (place = "") => lieu(place).replace(/^Near /, "");
const jourCourt = (ms) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const jourLong = (ms) => new Date(ms).toLocaleString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const heureUtc = (ms) => new Date(ms).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
const tag = (s) => "#" + s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
// Mean position on the sphere (works across the date line)
const centre = (pts) => { let x = 0, y = 0, z = 0; for (const [lo, la] of pts) { const a = lo * Math.PI / 180, b = la * Math.PI / 180; x += Math.cos(b) * Math.cos(a); y += Math.cos(b) * Math.sin(a); z += Math.sin(b); } return [Math.atan2(y, x) * 180 / Math.PI, Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI]; };
const semaineIso = (ms) => { const d = new Date(ms); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); };

export async function donneesHebdo(dateNy) {
  const fin = Date.parse(dateNy + "T00:00:00Z"), debut = fin - 7 * 864e5;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 19);
  const q = await json(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${iso(debut)}&endtime=${iso(fin)}&minmagnitude=4.5&orderby=time-asc`);
  const ev = q.features.filter((f) => f.properties.type === "earthquake" && f.properties.mag != null).map((f) => ({
    id: f.id, mag: Math.round(f.properties.mag * 10) / 10, place: f.properties.place ?? "", temps: f.properties.time, felt: f.properties.felt ?? 0, alerte: f.properties.alert,
    lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], prof: f.geometry.coordinates[2],
  }));
  if (ev.length < 20) throw new Error(`Semaine trop vide (${ev.length} séismes) : catalogue USGS incomplet ?`);
  const fort = ev.reduce((a, b) => (b.mag > a.mag ? b : a));
  // Busiest region; if it is the region of the strongest, the next one (the strongest already has its scene)
  const groupes = {}; for (const e of ev) (groupes[region(e.place)] ??= []).push(e);
  const classement = Object.entries(groupes).sort((a, b) => b[1].length - a[1].length);
  const [nomActif, actifs] = classement.find(([n]) => n !== region(fort.place)) ?? classement[0];
  const parJour = {}; for (const e of actifs) { const j = new Date(e.temps).toISOString().slice(0, 10); parJour[j] = (parJour[j] ?? 0) + 1; }
  const [jourMax, nJourMax] = Object.entries(parJour).sort((a, b) => b[1] - a[1])[0];
  const plusFortActif = actifs.reduce((a, b) => (b.mag > a.mag ? b : a));
  const profond = ev.reduce((a, b) => (b.prof > a.prof ? b : a)), ressenti = ev.reduce((a, b) => (b.felt > a.felt ? b : a));
  const mode = ressenti.felt >= 1000 ? "deux" : ressenti.felt < 100 ? "profond" : semaineIso(fin) % 2 ? "ressenti" : "profond";
  const classes = [["Major", "M7+", ev.filter((e) => e.mag >= 7).length], ["Strong", "M6–6.9", ev.filter((e) => e.mag >= 6 && e.mag < 7).length], ["Moderate", "M5–5.9", ev.filter((e) => e.mag >= 5 && e.mag < 6).length], ["Light", "M4.5–4.9", ev.filter((e) => e.mag < 5).length]];
  const t0 = ev[0].temps, t1 = ev.at(-1).temps;
  return {
    id: `hebdo-${dateNy}`, dateNy, debut, fin, n: ev.length, classes, mode,
    periode: `${jourCourt(debut)} – ${new Date(fin - 864e5).getUTCDate()}, ${new Date(fin - 864e5).getUTCFullYear()}`, semaineDe: jourCourt(debut).toUpperCase(),
    points: ev.map((e) => [Math.round(e.lon * 100) / 100, Math.round(e.lat * 100) / 100, e.mag, Math.round((e.temps - t0) / Math.max(1, t1 - t0) * 1000) / 1000, region(e.place) === nomActif ? 1 : 0]),
    fort: { ...fort, lieu: lieu(fort.place), ville: ville(fort.place), region: region(fort.place), jour: jourCourt(fort.temps), jourLong: jourLong(fort.temps), heure: heureUtc(fort.temps) },
    actif: { nom: nomActif, n: actifs.length, centre: centre(actifs.map((e) => [e.lon, e.lat])), etendue: Math.max(...actifs.map((e) => geoDistance([e.lon, e.lat], centre(actifs.map((x) => [x.lon, x.lat]))))), max: plusFortActif.mag, jourMax: jourCourt(Date.parse(jourMax)), jourMaxLong: jourLong(Date.parse(jourMax)), nJourMax, jourDuMax: jourCourt(plusFortActif.temps) },
    profond: { ...profond, lieu: lieu(profond.place), region: region(profond.place), jour: jourCourt(profond.temps), mi: kmEnMi(profond.prof), km: Math.round(profond.prof) },
    ressenti: { ...ressenti, lieu: lieu(ressenti.place), region: region(ressenti.place), jour: jourCourt(ressenti.temps) },
  };
}

export function textesHebdo(d) {
  const f = d.fort, a = d.actif, p = d.profond, r = d.ressenti;
  const pres = (x) => x.lieu.startsWith("Near ") ? x.lieu.replace(/^Near /, "near ") : DIRIGE.test(x.place) ? x.place.replace(/ region$/, "") : `in the ${x.lieu}`;
  // Same in the captions, Title Case: "Near X", "Southeast of X", "in the X"
  const dans = (x) => x.lieu.startsWith("Near ") || DIRIGE.test(x.place) ? x.lieu : `in the ${x.lieu}`;
  const phraseActif = `The busiest spot was ${a.nom === f.region ? "again " : ""}around ${a.nom}: ${a.n} quakes, led by a magnitude ${a.max.toFixed(1)}${a.nJourMax >= 10 ? `, with ${a.nJourMax} on ${a.jourMaxLong} alone` : ""}.`;
  const phraseProfond = `${d.mode === "deux" ? "The deepest" : "And the deepest"} started ${p.mi} miles below ${p.region}.`;
  const phraseRessenti = `${d.mode === "deux" ? "And the most felt" : "And the most felt"}, a magnitude ${r.mag.toFixed(1)} ${pres(r)}, drew ${nf.format(r.felt)} reports from people who felt it.`;
  const [maj, str, mod] = d.classes.map((c) => c[2]), liste = [maj && `${maj} major`, str && `${str} strong`, mod && `${mod} moderate`].filter(Boolean);
  const narration = [
    `This week, ${d.n} earthquakes of magnitude 4.5 or more shook the planet.`,
    `Among them: ${liste.length > 1 ? liste.slice(0, -1).join(", ") + (liste.length > 2 ? "," : "") + " and " + liste.at(-1) : liste[0] ?? "most were light"}.`,
    `The strongest, a magnitude ${f.mag.toFixed(1)}, struck ${pres(f)} on ${f.jourLong}.`,
    phraseActif,
    ...(d.mode === "profond" ? [phraseProfond] : d.mode === "ressenti" ? [phraseRessenti] : [phraseProfond, phraseRessenti]),
    `See every one of them on the live map, link in bio.`,
  ].join("\n\n");
  const emoji = f.mag >= 6 ? "🔴" : "🟠";
  const ligne5 = [...(d.mode !== "ressenti" ? [`⬇️ Deepest: ${p.mi} mi (${p.km} km), M${p.mag.toFixed(1)} ${dans(p)} (${p.jour})`] : []), ...(d.mode !== "profond" ? [`🙋 Most Felt: M${r.mag.toFixed(1)} ${r.lieu}, ${nf.format(r.felt)} Reports`] : [])];
  const lignes = [`📊 Quakes M4.5+: ${d.n}`, `${emoji} Strongest: M${f.mag.toFixed(1)}, ${f.lieu} (${f.jour})`, `📍 Busiest Spot: ${a.nom}, ${a.n} Quakes${a.nJourMax >= 10 ? ` (${a.nJourMax} on ${a.jourMax})` : ""}`, ...ligne5];
  const lieux = [...new Set([f.region, a.nom, d.mode !== "ressenti" ? p.region : r.region, d.mode === "deux" ? r.region : null].filter(Boolean).map(tag))];
  const sism = HASHTAGS.sismiques, s1 = variante(d.id, "sm", sism), s2 = sism[(sism.indexOf(s1) + 1) % sism.length], large = variante(d.id, "lg", HASHTAGS.larges);
  const titre = `🌍 This Week in Earthquakes, ${d.periode}`;
  return {
    type: "seisme", lien: "https://www.liveatlas.earth/", narration,
    legendes: {
      instagram: `${titre}\n\n${lignes.join("\n")}\n\n🗺️ Live Map, Link in Bio\n\n${["#Earthquake", s1, ...lieux, s2, large].join(" ")}`,
      x: ajusterX(`${titre.replace(/, \d{4}$/, "")}\n\n${lignes.join("\n")}\n\n👇 Live Map\nhttps://www.liveatlas.earth/\n\n`, ["#Earthquake", s1, ...lieux.slice(0, 2)], ["#Earthquake"]),
      facebook: `${titre}\n\n${lignes.join("\n")}\n\n👇 Live Map\nhttps://www.liveatlas.earth/\n\n${["#Earthquake", s1, ...lieux].join(" ")}`,
    },
  };
}

export function ecrireHebdo(d, txt, fichiers, sortie) {
  mkdirSync(sortie, { recursive: true });
  writeFileSync(join(sortie, "legendes.json"), JSON.stringify(txt, null, 1));
  writeFileSync(join(sortie, "reseaux.txt"), "reel");
  writeFileSync(join(sortie, "titre.txt"), `🌍 This Week in Earthquakes, ${d.periode} (weekly reel)`);
  writeFileSync(join(sortie, "issue.md"), [`**Weekly reel** · ${d.periode} · ${d.n} quakes M4.5+ · scene 5: ${d.mode} · [USGS catalog](https://earthquake.usgs.gov/earthquakes/map/)`, "", "Networks: reel (Instagram, Facebook); X by hand.", "",
    "### X", "```", txt.legendes.x, "```", "", "### Instagram", "```", txt.legendes.instagram, "```", "", "### Facebook", "```", txt.legendes.facebook, "```", "", "### Narration", "```", txt.narration, "```", ""].join("\n"));
}
export { RACINE };
