// Recent cloud-free satellite view of a place, for the volcano posts (Volcano Spotlight, On This Day): NASA HLS true color at 30 m
// (Landsat 8/9 and Sentinel-2, harmonized by NASA). The passes are found with NASA CMR and the image is drawn by NASA GIBS.
// CMR only gives the cloud cover of a whole 110 km tile, and clouds like volcano summits: each candidate is first fetched as a
// small PNG and checked here (no data and bright white pixels in the middle of the frame) before the full image is kept.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { inflateSync } from "node:zlib";
import { json } from "./commun.mjs";

const CAPTEUR = { HLSS30: ["Sentinel-2", "HLS_S30_Nadir_BRDF_Adjusted_Reflectance"], HLSL30: ["Landsat", "HLS_L30_Nadir_BRDF_Adjusted_Reflectance"] };

// Ray casting on a CMR polygon ("lat lon lat lon …")
const dedans = ([lon, lat], poly) => {
  const p = poly.split(" ").map(Number), n = p.length / 2;
  let ok = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi, yj, xj] = [p[2 * i], p[2 * i + 1], p[2 * j], p[2 * j + 1]];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
};

// Pixels of an 8-bit RGBA PNG (what GIBS returns), as [r, g, b, a] rows; null for any other kind
export function pixels(png) {
  const l = png.readUInt32BE(16), h = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) return null;
  const morceaux = [];
  for (let i = 8; i < png.length; ) { const n = png.readUInt32BE(i), t = png.toString("ascii", i + 4, i + 8); if (t === "IDAT") morceaux.push(png.subarray(i + 8, i + 8 + n)); i += 12 + n; }
  const brut = inflateSync(Buffer.concat(morceaux)), ligne = l * 4, sortie = Buffer.alloc(h * ligne);
  for (let y = 0; y < h; y++) {
    const f = brut[y * (ligne + 1)], src = brut.subarray(y * (ligne + 1) + 1, (y + 1) * (ligne + 1)), o = y * ligne;
    for (let x = 0; x < ligne; x++) {
      const a = x >= 4 ? sortie[o + x - 4] : 0, b = y ? sortie[o - ligne + x] : 0, c = x >= 4 && y ? sortie[o - ligne + x - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      sortie[o + x] = src[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
    }
  }
  return { l, h, px: (x, y) => sortie.subarray((y * l + x) * 4, (y * l + x) * 4 + 4) };
}

// Share of the frame without data (transparent), bright white (cloud, sometimes snow) in the middle half and around the summit,
// haze (mean of the darkest channel: about 30 to 80 for a clear view, over 100 when smoke or thin cloud veils it) and land in the middle
function examiner(png) {
  const im = pixels(png);
  if (!im) return null;
  let vide = 0, blanc = 0, milieu = 0, coeurBlanc = 0, coeur = 0, sombre = 0, terre = 0;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.l; x++) {
    const [r, g, b, a] = im.px(x, y);
    if (a < 128) { vide++; continue; } // no data is transparent (the sea, very dark, is not)
    sombre += Math.min(r, g, b);
    const dx = Math.abs(x / im.l - 0.5), dy = Math.abs(y / im.h - 0.5), clair = Math.min(r, g, b) >= 170;
    if (dx < 0.25 && dy < 0.25) { milieu++; blanc += clair; terre += 0.3 * r + 0.59 * g + 0.11 * b > 40; }
    if (dx < 0.12 && dy < 0.12) { coeur++; coeurBlanc += clair; }
  }
  return { vide: vide / (im.l * im.h), blanc: milieu ? blanc / milieu : 1, coeur: coeur ? coeurBlanc / coeur : 1, voile: sombre / Math.max(1, im.l * im.h - vide), terre: milieu ? terre / milieu : 0 };
}

// Writes a 1080 × 1350 view (about 34 × 42 km) centered on lon, lat; returns { date, capteur, credit } or null
export async function vueSatellite(lon, lat, fichier, { jours = 365, nuagesTuile = 30, blancMax = 0.015, coeurMax = 0.005, voileMax = 100, essais = 16 } = {}) {
  const dLat = 21 / 111.2, dLon = 16.8 / (111.2 * Math.cos((lat * Math.PI) / 180));
  const [o, s, e, n] = [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
  if (o < -180 || e > 180 || Math.abs(lat) > 75) return null;
  const debut = new Date(Date.now() - jours * 86400e3).toISOString().slice(0, 19) + "Z";
  const r = await json(`https://cmr.earthdata.nasa.gov/search/granules.json?short_name=HLSS30&short_name=HLSL30&bounding_box=${o},${s},${e},${n}&temporal=${debut},&cloud_cover=0,${nuagesTuile}&sort_key=-start_date&page_size=2000`);
  // One GIBS image per day and product: group the tiles, the newest day first, keep the days whose tiles cover the whole frame
  const passes = new Map();
  for (const g of r.feed.entry) {
    const produit = g.producer_granule_id.startsWith("HLS.S30") ? "HLSS30" : "HLSL30", cle = `${g.time_start.slice(0, 10)} ${produit}`;
    passes.set(cle, [...(passes.get(cle) ?? []), g]);
  }
  const grille = [0, 0.5, 1].flatMap((a) => [0, 0.5, 1].map((b) => [o + a * (e - o), s + b * (n - s)]));
  const candidats = [...passes].filter(([, tuiles]) => grille.every((pt) => tuiles.some((g) => (g.polygons ?? []).some((p) => dedans(pt, p[0]))))).slice(0, essais);
  const wms = (couche, date, l, h, format) => `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${couche}&TIME=${date}&CRS=EPSG:4326&BBOX=${s},${o},${n},${e}&WIDTH=${l}&HEIGHT=${h}&FORMAT=image/${format}&TRANSPARENT=TRUE`;
  for (const [cle] of candidats) {
    const [date, produit] = cle.split(" "), [capteur, couche] = CAPTEUR[produit];
    const petit = await fetch(wms(couche, date, 120, 150, "png"), { signal: AbortSignal.timeout(30000) });
    if (!petit.ok || !/png/.test(petit.headers.get("content-type") ?? "")) continue;
    const ex = examiner(Buffer.from(await petit.arrayBuffer()));
    if (!ex || ex.vide > 0.01 || ex.blanc > blancMax || ex.coeur > coeurMax || ex.voile > voileMax) continue;
    // Mostly sea in the middle (submarine volcano, tiny island): the map tells more, no second image
    if (ex.terre < 0.15) return null;
    const img = await fetch(wms(couche, date, 1080, 1350, "jpeg"), { signal: AbortSignal.timeout(60000) });
    if (!img.ok || !/jpeg/.test(img.headers.get("content-type") ?? "")) continue;
    mkdirSync(dirname(fichier), { recursive: true }); writeFileSync(fichier, Buffer.from(await img.arrayBuffer()));
    return { date, capteur, credit: "NASA HLS" };
  }
  return null;
}
