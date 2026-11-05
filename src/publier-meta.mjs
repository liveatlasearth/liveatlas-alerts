// Step run by the workflow after the release is created (the files then have public URLs).
// For each alert in sortie/: Instagram and Facebook reel (if "reel") or carousel / multi-photo post (if "instagram" / "facebook").
// Then the same post on Threads (src/threads.mjs) when the account has a token; never retried, so it cannot go out twice.
// Writes sortie/<id>/publie.md (links of the posts) for the issue. Without the META_PAGE_TOKEN_SEISMES secret, does nothing.
// Usage: node src/publier-meta.mjs <release base URL with {id}>   e.g. https://github.com/o/r/releases/download/alert-{id}-123
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RACINE } from "./commun.mjs";
import { carrouselInstagram, comptes, photosFacebook, reelFacebook, reelInstagram } from "./meta.mjs";
import { jetonThreads, postThreads, texteThreads, verifierThreads } from "./threads.mjs";

const jetonBrut = process.env.META_PAGE_TOKEN_SEISMES, base = process.argv[2], filtre = (process.env.RESEAUX || "").split(",").filter(Boolean);
if (!jetonBrut) { console.log("Pas de jeton Meta : publication Instagram et Facebook sautée (mode brouillon)."); process.exit(0); }
// One Page per account: earthquakes (and tsunamis) on the "Earthquake" Page, volcanoes on the "Volcano" Page
const pages = {};
const compte = async (type) => (pages[type] ??= await comptes(jetonBrut, type === "volcan" ? "Volcano" : "Earthquake").then((c) => { console.log(`Page ${c.nomPage} (${c.page}), Instagram ${c.ig ?? "non relié"}`); return c; }));
// Check mode (manual run with networks "verifier"): reads both Pages and their Instagram accounts, publishes nothing
if (filtre.includes("verifier")) { for (const t of ["seisme", "volcan"]) { console.log(`Threads ${t} :`, await verifierThreads(t).catch((e) => `ERREUR ${e.message}`)); }
  for (const t of ["seisme", "volcan"]) { const c = await compte(t); console.log(t, "→", c.nomPage, "Instagram", c.ig ? "relié" : "NON RELIÉ"); } process.exit(0); }
const SORTIE = join(RACINE, "sortie"), ETAT = join(RACINE, "etat", "publies.json");
const etat = existsSync(ETAT) ? JSON.parse(readFileSync(ETAT, "utf8")) : {};
let etatModifie = false;
for (const id of readdirSync(SORTIE)) {
  const dir = join(SORTIE, id); if (!existsSync(join(dir, "legendes.json"))) continue;
  const txt = JSON.parse(readFileSync(join(dir, "legendes.json"), "utf8")), reseaux = readFileSync(join(dir, "reseaux.txt"), "utf8").trim().split(",").filter((r) => !filtre.length || filtre.includes(r));
  const c = await compte(txt.type), jeton = c.jeton;
  const url = (f) => `${base.replace("{id}", id)}/${f}`, a = (f) => existsSync(join(dir, f)), liens = [];
  const essai = async (nom, f) => { const t0 = Date.now(); try { const l = await f(); liens.push(`- ${nom} : ${l} (${Math.round((Date.now() - t0) / 1000)} s)`); console.log(nom, "→", l); return true; } catch (e) { liens.push(`- ${nom} : ÉCHEC ${e.message}`); console.log(nom, "échec :", e.message); return false; } };
  const echecs = [];
  if (reseaux.includes("reel") && a("reel.mp4")) {
    const ig = c.ig ? await essai("Instagram reel", () => reelInstagram(c, url("reel.mp4"), url("reel-cover-9x16.jpg"), txt.legendes.instagram, jeton)) : false;
    const fb = await essai("Facebook reel", () => reelFacebook(c, url("reel.mp4"), txt.legendes.facebook, jeton));
    if (!ig && !fb) echecs.push("reel"); // one of the two out: no retry, it would post that one twice
  }
  const images = ["post-4x5.jpg", "post-4x5-secousses.jpg", "post-4x5-photo-1.jpg", "post-4x5-photo-2.jpg", "post-4x5-satellite.jpg"].filter(a).map(url);
  if (reseaux.includes("instagram") && c.ig && images.length && !(await essai("Instagram post", () => carrouselInstagram(c, images, txt.legendes.instagram, jeton)))) echecs.push("instagram");
  if (reseaux.includes("facebook") && images.length && !(await essai("Facebook post", () => photosFacebook(c, images, txt.legendes.facebook, jeton)))) echecs.push("facebook");
  const jt = await jetonThreads(txt.type === "volcan" ? "volcan" : "seisme").catch(() => null), video = reseaux.includes("reel") && a("reel.mp4");
  if (jt && (video || ((reseaux.includes("instagram") || reseaux.includes("facebook")) && images.length)))
    await essai("Threads post", () => postThreads(txt.type, video ? { video: url("reel.mp4") } : { images }, texteThreads(txt.legendes.facebook), jt));
  // Earthquakes of a scheduled run: a network that failed is taken off the memory, so the next run tries again, once
  // (the "<network>_echec" mark stops a second retry). Volcanoes and the weekly reel are not retried.
  if (!filtre.length && etat[id]) for (const r of echecs) {
    if (etat[id][`${r}_echec`]) continue;
    delete etat[id][r]; etat[id][`${r}_echec`] = new Date().toISOString(); etatModifie = true;
    liens.push(`- ${r} : nouvelle tentative au prochain passage`);
  }
  writeFileSync(join(dir, "publie.md"), `## Published\n${liens.join("\n")}\n`);
}
if (etatModifie) writeFileSync(ETAT, JSON.stringify(etat, null, 1));
