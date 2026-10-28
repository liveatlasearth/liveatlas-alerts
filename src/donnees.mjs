// Everything about one earthquake, from official sources only: USGS event page (details, ShakeMap intensity contours,
// PAGER exposed population and cities), Natural Earth countries, PB2002 plate boundaries, NASA GIBS satellite images.
// Writes public/evenements/<id>/ (donnees.json, sat-*.jpg) for the Remotion compositions.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { find as fuseau } from "geo-tz";
import { json, kmEnMi, lireJson, RACINE, ecrireJson } from "./commun.mjs";
import { pays } from "./detecter.mjs";

const arr = (n) => (a) => Array.isArray(a[0]) ? a.map(arr(n)) : [+a[0].toFixed(n), +a[1].toFixed(n)];
let GEO = null;
const geoMonde = () => GEO ??= { p50: lireJson("donnees", "ne_pays_50m.geojson"), p110: lireJson("donnees", "ne_pays_110m.geojson"), plaques: lireJson("donnees", "pb2002_frontieres.geojson") };
const rad = (x) => x * Math.PI / 180, DIR = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const COURT = { "United States of America": "United States", "Dem. Rep. Congo": "DR Congo" };

export async function donnees(id) {
  const d = await json(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${id}.geojson`);
  const P = d.properties, [lon, lat, prof] = d.geometry.coordinates, pr = P.products;
  const url = (prod, f) => pr[prod]?.[0]?.contents[f]?.url;
  const cont = url("shakemap", "download/cont_mmi.json") ? await json(url("shakemap", "download/cont_mmi.json")) : null;
  const villes = url("losspager", "json/cities.json") ? await json(url("losspager", "json/cities.json")) : null;
  const expo = url("losspager", "json/exposures.json") ? await json(url("losspager", "json/exposures.json")) : null;

  const depuis = (lo, la) => {
    const dl = rad(la - lat), dn = rad(lo - lon), a = Math.sin(dl / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(la)) * Math.sin(dn / 2) ** 2;
    const km = 2 * 6371 * Math.asin(Math.sqrt(a)), y = Math.sin(dn) * Math.cos(rad(la)), x = Math.cos(rad(lat)) * Math.sin(rad(la)) - Math.sin(rad(lat)) * Math.cos(rad(la)) * Math.cos(dn);
    return { km: Math.round(km), mi: kmEnMi(km), dir: DIR[Math.round(((Math.atan2(y, x) * 180 / Math.PI + 360) % 360) / 22.5) % 16] };
  };
  const listeVilles = villes ? [...villes.onepager_cities, ...villes.all_cities].filter((c, i, a) => a.findIndex((x) => x.name === c.name) === i)
    .sort((a, b) => b.mmi - a.mmi).slice(0, 6).map((c) => ({ nom: c.name, lon: c.lon, lat: c.lat, pop: c.pop, mmi: +c.mmi.toFixed(2), ...depuis(c.lon, c.lat) })) : [];

  const G = geoMonde(), dans = (f, m) => JSON.stringify(f.geometry.coordinates).match(/-?\d+\.?\d*,-?\d+\.?\d*/g).some((t) => { const [x, y] = t.split(",").map(Number); return Math.abs(x - lon) < m && Math.abs(y - lat) < m; });
  const geo = {
    detail: { type: "FeatureCollection", features: G.p50.features.filter((f) => dans(f, 25)).map((f) => ({ type: "Feature", geometry: { type: f.geometry.type, coordinates: arr(3)(f.geometry.coordinates) } })) },
    monde: { type: "FeatureCollection", features: G.p110.features.map((f) => ({ type: "Feature", geometry: { type: f.geometry.type, coordinates: arr(2)(f.geometry.coordinates) } })) },
    plaques: { type: "FeatureCollection", features: G.plaques.features.map((f) => ({ type: "Feature", geometry: { type: f.geometry.type, coordinates: arr(2)(f.geometry.coordinates) } })) },
    pays: G.p110.features.map((f) => [COURT[f.properties.NAME] ?? f.properties.NAME, +f.properties.LABEL_X.toFixed(2), +f.properties.LABEL_Y.toFixed(2), f.properties.LABELRANK]).sort((a, b) => a[3] - b[3]),
  };

  // NASA GIBS: cloud-free Blue Marble right away; the next-day MODIS image once it exists (reels made later)
  const dossier = join(RACINE, "public", "evenements", id);
  const bbox = [lat - 1.2, lon - 1.35, lat + 1.2, lon + 1.35].map((x) => x.toFixed(3)).join(",");
  const gibs = (c) => `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${c}&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=1080&HEIGHT=960&FORMAT=image/jpeg`;
  const lendemain = new Date(P.time + 86400e3).toISOString().slice(0, 10), jourDispo = Date.now() - P.time > 30 * 3600e3;
  const sat = jourDispo ? { fichier: "sat-jour.jpg", couche: `MODIS_Terra_CorrectedReflectance_TrueColor&TIME=${lendemain}`, jour: lendemain } : { fichier: "sat-blue-marble.jpg", couche: "BlueMarble_NextGeneration", jour: null };
  const r = await fetch(gibs(sat.couche)); mkdirSync(dossier, { recursive: true });
  if (r.ok) { writeFileSync(join(dossier, sat.fichier), Buffer.from(await r.arrayBuffer())); }

  const ex = expo?.population_exposure?.aggregated_exposure ?? [];
  const sortie = {
    id, mag: +P.mag.toFixed(1), lieu: P.place, pays: pays(P.place), temps: P.time, fuseau: fuseau(lat, lon)[0] ?? "UTC", lon, lat,
    prof_km: +prof.toFixed(1), prof_mi: kmEnMi(prof), pager: P.alert, ressenti: P.felt, mmi_max: P.mmi, tsunami: P.tsunami, url: P.url,
    exposition: ex, exposes_vi_plus: ex.slice(5).reduce((a, b) => a + b, 0), villes: listeVilles,
    shakemap: cont && { type: "FeatureCollection", features: cont.features.filter((f) => f.properties.value % 1 === 0).map((f) => ({ type: "Feature", properties: { mmi: f.properties.value }, geometry: { type: f.geometry.type, coordinates: arr(3)(f.geometry.coordinates) } })) },
    satellite: { ...sat, credit: "NASA GIBS" }, geo,
  };
  ecrireJson(join(dossier, "donnees.json"), sortie, false);
  return sortie;
}
