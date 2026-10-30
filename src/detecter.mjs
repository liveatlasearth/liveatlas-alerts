// Earthquake detection from the USGS real-time feed and the thresholds of config/seuils.json.
// Returns, for each event, the networks it should be posted on (x, instagram, facebook, reel) that have not been done yet.
import { json, nomPropre, SEUILS } from "./commun.mjs";

const FLUX = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const ETATS = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "CA", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "Puerto Rico"];
const S = SEUILS.seismes;
// Distance in km between two [lon, lat] points (haversine)
const distKm = ([lo1, la1], [lo2, la2]) => { const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(a)); };
const ZONES_FOCUS = { Japan: 4.5, Mexico: 4.5, Philippines: 4.5, Taiwan: 4.5 };

// Country or state at the end of the USGS place ("62 km SSE of Sand Point, Alaska", "Bonin Islands, Japan region", "southeast of Easter Island")
export const pays = (lieu = "") => nomPropre(lieu.split(",").pop().trim().replace(/ region$/i, ""));
export const auxUSA = (lieu = "") => { const p = pays(lieu); return ETATS.includes(p) || /\b(Alaska|Hawaii)\b/.test(lieu); };

export function reseaux(q) {
  const { mag, place, alert } = q.properties, p = pays(place), usa = auxUSA(place);
  const seuilZone = usa ? 4.0 : ZONES_FOCUS[p] ?? S.reste_du_monde_magnitude_min;
  if (mag < seuilZone) return [];
  const r = ["x"];
  if (mag >= S.par_reseau.instagram_facebook.magnitude_min || (usa && mag >= 4.5) || (p === "Japan" && mag >= 5)) r.push("instagram", "facebook");
  if (mag >= S.reel.magnitude_min || ["orange", "red"].includes(alert)) r.push("reel");
  return r;
}

// etat: { <id>: { x: date, instagram: date, … } } ; jour: posts already made today per network
export async function detecter(etat, maintenant = Date.now()) {
  const flux = await json(FLUX), attente = S.attente_avant_post_minutes * 60e3, agePlus = 6 * 3600e3;
  const aFaire = [];
  // One quake can change id: a regional network posts it first (aka…), then the USGS solution becomes preferred (us…) and lists both
  // in "ids". Before that merge, both can sit in the feed: same quake if within 30 s and 100 km (False Pass M4.8 / M5.0, Oct 29, 2026)
  const ids = (q) => (q.properties.ids ?? "").split(",").filter(Boolean).concat(q.id);
  const fait = (q) => Object.assign({}, ...ids(q).map((i) => etat[i] ?? {}));
  const pres = (a, b) => Math.abs(a.properties.time - b.properties.time) <= 30e3 && distKm(a.geometry.coordinates, b.geometry.coordinates) <= 100;
  // Values the USGS is still likely to replace (settings of Oct 30, 2026): a quick magnitude (mb, ml, md…) from M5.5 until the moment
  // magnitude (Mww, Mwr…) comes, a US regional network until the USGS solution takes over; never longer than the caps
  const provisoire = (q, age) => (q.properties.mag >= S.magnitude_finale_des && !/^mw/i.test(q.properties.magType ?? "") && age < S.attente_magnitude_finale_minutes * 60e3)
    || (q.properties.net !== "us" && age < S.attente_reseau_regional_minutes * 60e3);
  // The USGS solution first, so that it is the one posted when two networks show the same quake in one run
  const pris = [], ordre = [...flux.features].sort((a, b) => (b.properties.net === "us") - (a.properties.net === "us"));
  for (const q of ordre) {
    const age = maintenant - q.properties.time;
    if (age < attente || age > agePlus || provisoire(q, age)) continue;
    if (pris.some((v) => pres(q, v))) continue;
    const deja = Object.assign(fait(q), ...flux.features.filter((v) => v !== q && pres(q, v)).map(fait)), manque = reseaux(q).filter((r) => !deja[r]);
    if (manque.length) { pris.push(q); aFaire.push({ id: q.id, mag: q.properties.mag, lieu: q.properties.place, temps: q.properties.time, reseaux: manque, pager: q.properties.alert }); }
  }
  return aFaire.sort((a, b) => a.temps - b.temps);
}
