// Step run by the workflow after the release is created (the files then have public URLs).
// For each alert in sortie/: Instagram and Facebook reel (if "reel") or carousel / multi-photo post (if "instagram" / "facebook").
// Writes sortie/<id>/publie.md (links of the posts) for the issue. Without the META_PAGE_TOKEN_SEISMES secret, does nothing.
// Usage: node src/publier-meta.mjs <release base URL with {id}>   e.g. https://github.com/o/r/releases/download/alert-{id}-123
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RACINE } from "./commun.mjs";
import { carrouselInstagram, comptes, photosFacebook, reelFacebook, reelInstagram } from "./meta.mjs";

const jeton = process.env.META_PAGE_TOKEN_SEISMES, base = process.argv[2], filtre = (process.env.RESEAUX || "").split(",").filter(Boolean);
if (!jeton) { console.log("Pas de jeton Meta : publication Instagram et Facebook sautée (mode brouillon)."); process.exit(0); }
const c = await comptes(jeton);
console.log(`Page ${c.nomPage} (${c.page}), Instagram ${c.ig ?? "non relié"}`);
const SORTIE = join(RACINE, "sortie");
for (const id of readdirSync(SORTIE)) {
  const dir = join(SORTIE, id); if (!existsSync(join(dir, "legendes.json"))) continue;
  const txt = JSON.parse(readFileSync(join(dir, "legendes.json"), "utf8")), reseaux = readFileSync(join(dir, "reseaux.txt"), "utf8").trim().split(",").filter((r) => !filtre.length || filtre.includes(r));
  const url = (f) => `${base.replace("{id}", id)}/${f}`, a = (f) => existsSync(join(dir, f)), liens = [];
  const essai = async (nom, f) => { const t0 = Date.now(); try { const l = await f(); liens.push(`- ${nom} : ${l} (${Math.round((Date.now() - t0) / 1000)} s)`); console.log(nom, "→", l); } catch (e) { liens.push(`- ${nom} : ÉCHEC ${e.message}`); console.log(nom, "échec :", e.message); } };
  if (reseaux.includes("reel") && a("reel.mp4")) {
    if (c.ig) await essai("Instagram reel", () => reelInstagram(c, url("reel.mp4"), url("reel-cover-9x16.jpg"), txt.legendes.instagram, jeton));
    await essai("Facebook reel", () => reelFacebook(c, url("reel.mp4"), txt.legendes.facebook, jeton));
  }
  const images = ["post-4x5.jpg", "post-4x5-secousses.jpg"].filter(a).map(url);
  if (reseaux.includes("instagram") && c.ig && images.length) await essai("Instagram post", () => carrouselInstagram(c, images, txt.legendes.instagram, jeton));
  if (reseaux.includes("facebook") && images.length) await essai("Facebook post", () => photosFacebook(c, images, txt.legendes.facebook, jeton));
  writeFileSync(join(dir, "publie.md"), `## Published\n${liens.join("\n")}\n`);
}
