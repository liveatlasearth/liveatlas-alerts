// Threads (@LiveAtlasQuakes, @LiveAtlasErupts): the same posts as Instagram and Facebook (user request of Nov 5, 2026), through the
// Threads API of the "Live Atlas Alerts" Meta app (permissions threads_basic and threads_content_publish).
// Tokens: THREADS_TOKEN_SEISMES and THREADS_TOKEN_VOLCANS secrets (long-lived, 60 days). They are refreshed once a week and the
// fresh token is kept in etat/threads.json, encrypted with the THREADS_CLE secret (AES-256-GCM), since a workflow cannot rewrite its
// own secrets. Without a token for an account, nothing is posted for it.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RACINE } from "./commun.mjs";

const API = "https://graph.threads.com/v1.0", FICHIER = join(RACINE, "etat", "threads.json");
const SECRETS = { seisme: "THREADS_TOKEN_SEISMES", volcan: "THREADS_TOKEN_VOLCANS" }, CLE = { seisme: "seismes", volcan: "volcans" };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const cle = () => process.env.THREADS_CLE ? createHash("sha256").update(process.env.THREADS_CLE).digest() : null;
const chiffrer = (t) => { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", cle(), iv), x = Buffer.concat([c.update(t, "utf8"), c.final()]); return [iv, c.getAuthTag(), x].map((b) => b.toString("base64")).join("."); };
const dechiffrer = (s) => { const [iv, tag, x] = s.split(".").map((b) => Buffer.from(b, "base64")), d = createDecipheriv("aes-256-gcm", cle(), iv); d.setAuthTag(tag); return Buffer.concat([d.update(x), d.final()]).toString("utf8"); };

async function appel(chemin, params, jeton, methode = "POST") {
  const u = new URL(chemin.startsWith("http") ? chemin : API + chemin);
  for (const [k, v] of Object.entries({ ...params, access_token: jeton })) u.searchParams.set(k, v);
  const r = await fetch(u, { method: methode, signal: AbortSignal.timeout(60000) }), j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Threads ${chemin}: ${j.error?.message ?? r.status}`);
  return j;
}

// Token of an account ("seisme" or "volcan"): the refreshed one of etat/threads.json when it decrypts, else the secret.
// Refreshed when more than 7 days old (Threads allows it after 24 h and before the 60 days run out).
export async function jetonThreads(type) {
  const secret = process.env[SECRETS[type]]; if (!secret) return null;
  const etat = existsSync(FICHIER) ? JSON.parse(readFileSync(FICHIER, "utf8")) : {}, e = etat[CLE[type]];
  let jeton = secret, date = 0;
  if (e && cle()) try { jeton = dechiffrer(e.jeton); date = Date.parse(e.date); } catch { jeton = secret; }
  if (cle() && Date.now() - date > 7 * 86400e3) try {
    const r = await appel("https://graph.threads.com/refresh_access_token", { grant_type: "th_refresh_token" }, jeton, "GET");
    jeton = r.access_token; etat[CLE[type]] = { jeton: chiffrer(jeton), date: new Date().toISOString() };
    writeFileSync(FICHIER, JSON.stringify(etat, null, 1) + "\n"); console.log(`Threads ${type} : jeton rafraîchi`);
  } catch (err) { console.log(`Threads ${type} : rafraîchissement impossible (${err.message}), jeton actuel gardé`); }
  return jeton;
}

// Text of a Threads post: the Facebook caption (it carries the link), hashtags taken off but one (Threads keeps a single topic tag),
// at most 500 characters, emojis counted as their UTF-8 bytes as Threads does (lines dropped from the end of the body when too long)
export function texteThreads(facebook) {
  const blocs = facebook.trim().split("\n\n"), tags = /^#\S+( #\S+)*$/.test(blocs.at(-1)) ? blocs.pop().split(" ") : [], n = (x) => Buffer.byteLength(x, "utf8");
  let t = blocs.join("\n\n") + (tags[0] ? `\n\n${tags[0]}` : "");
  while (n(t) > 500 && blocs[0].includes("\n")) { blocs[0] = blocs[0].split("\n").slice(0, -1).join("\n"); t = blocs.join("\n\n") + (tags[0] ? `\n\n${tags[0]}` : ""); }
  while (n(t) > 500) t = [...t].slice(0, -1).join("");
  return t;
}

// Wait until a container is ready (videos take a while), then publish and return the link of the post
async function publier(moi, conteneur, jeton) {
  for (let i = 0; i < 40; i++) {
    const s = await appel(`/${conteneur}`, { fields: "status,error_message" }, jeton, "GET");
    if (s.status === "FINISHED") break;
    if (s.status === "ERROR" || s.status === "EXPIRED") throw new Error(`conteneur ${s.status} ${s.error_message ?? ""}`);
    await attendre(i < 3 ? 5000 : 15000);
  }
  const { id } = await appel(`/${moi}/threads_publish`, { creation_id: conteneur }, jeton);
  return (await appel(`/${id}`, { fields: "permalink" }, jeton, "GET")).permalink ?? id;
}

// A video (the reel), or one image, or a carousel of 2 to 20 images; URLs must be public (the GitHub release of the alert)
export async function postThreads(type, { video, images = [] }, texte, jeton) {
  const moi = (await appel("/me", { fields: "id" }, jeton, "GET")).id;
  if (video) return publier(moi, (await appel(`/${moi}/threads`, { media_type: "VIDEO", video_url: video, text: texte }, jeton)).id, jeton);
  if (images.length === 1) return publier(moi, (await appel(`/${moi}/threads`, { media_type: "IMAGE", image_url: images[0], text: texte }, jeton)).id, jeton);
  const enfants = [];
  for (const u of images.slice(0, 20)) enfants.push((await appel(`/${moi}/threads`, { media_type: "IMAGE", image_url: u, is_carousel_item: "true" }, jeton)).id);
  return publier(moi, (await appel(`/${moi}/threads`, { media_type: "CAROUSEL", children: enfants.join(","), text: texte }, jeton)).id, jeton);
}
