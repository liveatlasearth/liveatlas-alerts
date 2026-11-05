// Real photos and videos for the reels of the regular posts, from Wikimedia Commons, free licences only (user request of Nov 5, 2026).
// A file is kept only when its licence allows reuse (public domain, CC0, CC BY, CC BY-SA), it is large enough for a 1080 × 1920
// frame, and its name does not look like a map, chart or diagram. The author and licence go with it: the reel shows them small
// and the caption names them (CC BY asks for credit). Nothing is ever invented: when no file passes, the scene is left out.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RACINE } from "./commun.mjs";
import { pixels } from "./satellite.mjs";

const API = "https://commons.wikimedia.org/w/api.php", UA = { "user-agent": "liveatlas-alerts (+https://www.liveatlas.earth)" };
const LIBRE = /^(Public domain|PD\b|CC0|CC BY(-SA)? \d|CC-BY(-SA)?-\d|No restrictions|Attribution)/i;
const ECARTER = /\b(map|carte|karte|mapa|diagram|chart|graph|graphic|schema|profile|model|poster|logo|flag|stamp|coat of arms|seal|plan|sketch|drawing of rock|shakemap|intensity|seismogram|location|tectonic|cross[- ]section|finite fault|labels\))/i;
const texte = (h = "") => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();
const court = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

// Files matching a Commons search ("Sakurajima 1914 eruption"), best first; video: true looks for videos only
export async function chercher(requete, { video = false, n = 12 } = {}) {
  const q = `${requete} filetype:${video ? "video" : "bitmap"}`;
  const url = `${API}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=${n}&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&iiextmetadatafilter=LicenseShortName|Artist|Credit`;
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) }).then((x) => x.json()).catch(() => null);
  return Object.values(r?.query?.pages ?? {}).sort((a, b) => a.index - b.index).map((p) => {
    const i = p.imageinfo?.[0] ?? {}, m = i.extmetadata ?? {};
    return { titre: p.title.slice(5), url: i.url, vignette: i.thumburl, l: i.width, h: i.height, mime: i.mime, page: i.descriptionurl,
      licence: texte(m.LicenseShortName?.value), auteur: court(texte(m.Artist?.value) || texte(m.Credit?.value) || "Unknown author", 60) };
  }).filter((f) => f.url && LIBRE.test(f.licence) && !ECARTER.test(f.titre) && Math.min(f.l, f.h) >= (video ? 700 : 600) && f.l / f.h < 2.4
    && (video ? /webm|ogg|mp4/.test(f.mime) : /jpeg|png/.test(f.mime)));
}

// First file of the first search that finds one; requetes = ["Sakurajima 1914 eruption", "Sakurajima eruption", …]
export async function premier(requetes, options = {}) {
  for (const q of requetes) { const f = (await chercher(q, options))[0]; if (f) return f; }
  return null;
}

// Image of a Wikidata item (P18), for the earthquakes with a site page
export async function imageWikidata(qid) {
  const r = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, { headers: UA, signal: AbortSignal.timeout(30000) }).then((x) => x.json()).catch(() => null);
  const nom = r?.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!nom) return null;
  return (await chercher(`"${nom.replace(/\.[a-z]+$/i, "")}"`, { n: 3 })).find((f) => f.titre === nom) ?? null;
}

// Download a file into public/evenements/<dossier>/<nom>: a photo as JPEG (the 1600 px version), a video as an H.264 clip of
// at most 8 s, scaled to 1920 px high (the reel crops it). Returns { fichier, video, credit } or null.
export async function telecharger(f, dossier, nom) {
  if (!f) return null;
  const dir = join(RACINE, "public", "evenements", dossier); mkdirSync(dir, { recursive: true });
  const video = /video|webm|ogg/.test(f.mime), brut = join(dir, `${nom}-brut.${video ? "webm" : /png/.test(f.mime) ? "png" : "jpg"}`), sortie = join(dir, `${nom}.${video ? "mp4" : "jpg"}`);
  const r = await fetch(video ? f.url : f.vignette ?? f.url, { headers: UA, signal: AbortSignal.timeout(120000) });
  if (!r.ok) return null;
  writeFileSync(brut, Buffer.from(await r.arrayBuffer()));
  const ff = (args) => execFileSync("npx", ["remotion", "ffmpeg", ...(process.platform === "win32" ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args)], { shell: process.platform === "win32", cwd: RACINE, stdio: "ignore" });
  try {
    if (video) ff(["-y", "-i", brut, "-t", "8", "-an", "-vf", "scale=-2:1920:flags=lanczos,crop='min(iw,1080)':1920", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", sortie]);
    else ff(["-y", "-i", brut, "-q:v", "3", sortie]);
  } catch { return null; } finally { rmSync(brut, { force: true }); }
  if (!existsSync(sortie)) return null;
  // A photo, not a map or a chart: on a 48 × 48 thumbnail, maps and charts show a lot of plain white (the Wikidata image of
  // the 2012 Guatemala earthquake is a USGS ShakeMap: 29 % white; photos tested: 0 to 3 %)
  if (!video) try {
    const vignette = join(dir, `${nom}-test.png`);
    ff(["-y", "-loglevel", "error", "-i", sortie, "-vf", "scale=48:48", "-pix_fmt", "rgba", vignette]);
    const im = pixels(readFileSync(vignette)); rmSync(vignette, { force: true });
    let blanc = 0; for (let y = 0; y < im.h; y++) for (let x = 0; x < im.l; x++) if (Math.min(...im.px(x, y).subarray(0, 3)) > 235) blanc++;
    if (blanc / (im.l * im.h) > 0.15) { rmSync(sortie, { force: true }); return null; }
  } catch { /* the check is a safeguard only */ }
  return { fichier: `evenements/${dossier}/${nom}.${video ? "mp4" : "jpg"}`, video, credit: `${f.auteur} · ${f.licence}`, titre: f.titre, page: f.page };
}
