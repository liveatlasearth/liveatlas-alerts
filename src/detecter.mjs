// Earthquake detection from the USGS real-time feed and the thresholds of config/seuils.json.
// Returns, for each event, the networks it should be posted on (x, instagram, facebook, reel) that have not been done yet.
import { json, SEUILS } from "./commun.mjs";

const FLUX = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const ETATS = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "CA", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "Puerto Rico"];
const S = SEUILS.seismes;
const ZONES_FOCUS = { Japan: 4.5, Mexico: 4.5, Philippines: 4.5, Taiwan: 4.5 };

// Country or state at the end of the USGS place ("62 km SSE of Sand Point, Alaska", "Bonin Islands, Japan region")
export const pays = (lieu = "") => { const fin = lieu.split(",").pop().trim().replace(/ region$/i, ""); return fin; };
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
  for (const q of flux.features) {
    const age = maintenant - q.properties.time;
    if (age < attente || age > agePlus) continue; // the USGS often revises the magnitude in the first minutes
    const deja = etat[q.id] ?? {}, manque = reseaux(q).filter((r) => !deja[r]);
    if (manque.length) aFaire.push({ id: q.id, mag: q.properties.mag, lieu: q.properties.place, temps: q.properties.time, reseaux: manque, pager: q.properties.alert });
  }
  return aFaire.sort((a, b) => a.temps - b.temps);
}
