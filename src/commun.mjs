// Shared helpers of the Live Atlas alert engine.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const RACINE = join(import.meta.dirname, "..");
export const lireJson = (...p) => JSON.parse(readFileSync(join(RACINE, ...p), "utf8"));
export const ecrireJson = (fichier, objet, joli = true) => { mkdirSync(dirname(fichier), { recursive: true }); writeFileSync(fichier, JSON.stringify(objet, null, joli ? 1 : 0)); };
export const SEUILS = lireJson("config", "seuils.json");
export const COMPTES = lireJson("config", "comptes.json");

export async function json(url, essais = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "liveatlas-alerts (+https://www.liveatlas.earth)" } });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) { if (i >= essais) throw e; await new Promise((ok) => setTimeout(ok, 2000 * i)); }
  }
}

export const nf = new Intl.NumberFormat("en-US");
export const kmEnMi = (km) => Math.round(km / 1.609344);
export const ROMAIN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export const NOM_MMI = { 1: "Not Felt", 2: "Weak", 3: "Weak", 4: "Light", 5: "Moderate", 6: "Strong", 7: "Very Strong", 8: "Severe", 9: "Violent", 10: "Extreme" };
// USGS magnitude classes: color of the pill, the number, the rings and the caption emoji
export const CLASSES = [[8, "Great", "#B0124A", "🟣"], [7, "Major", "#E5303A", "🔴"], [6, "Strong", "#FF6A4D", "🔴"], [5, "Moderate", "#F2A93B", "🟠"], [4, "Light", "#F2D14B", "🟡"], [0, "Minor", "#F2D14B", "🟡"]];
export const classe = (mag) => { const [, nom, couleur, emoji] = CLASSES.find(([m]) => mag >= m); return { nom, couleur, emoji }; };
// USGS places with no town nearby start lowercase: "southeast of Easter Island", "off the coast of Oregon", "central Mid-Atlantic Ridge".
// DIRIGE: the place is a direction, said without "in the"; nomPropre: the proper name only (hashtags, regions); titreLieu: Title Case for display
export const DIRIGE = /^(?:north|south|east|west)[a-z]* of |^(?:off|near) the /;
export const nomPropre = (s) => s.replace(/^(?:[a-z]+ )+/, "");
const PETITS = ["of", "the", "and", "on", "in", "at", "off"];
export const titreLieu = (s) => s.split(" ").map((w, i) => i && PETITS.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
// Length of a post as X counts it (X without a paid plan: 280): a link = 23, an emoji = 2 (its variation selector free),
// Latin letters and common punctuation = 1, everything else = 2 (twitter-text rules)
export const longueurX = (t) => {
  let n = 0;
  for (const c of t.replace(/https?:\/\/\S+/g, "x".repeat(23)).replace(/️/g, "")) {
    const p = c.codePointAt(0);
    n += p <= 0x10ff || (p >= 0x2000 && p <= 0x200d) || (p >= 0x2010 && p <= 0x201f) || (p >= 0x2032 && p <= 0x2037) ? 1 : 2;
  }
  return n;
};
// X post that fits: hashtags dropped from the end (never those in "garder") until it is 280 or less
export const ajusterX = (corps, tags, garder = []) => {
  const t = [...new Set(tags)];
  while (longueurX(corps + t.join(" ")) > 280) { const i = t.findLastIndex((x) => !garder.includes(x)); if (i < 0) break; t.splice(i, 1); }
  return corps + t.join(" ");
};
// Stable choice among wording variants: the same event always gets the same text, two events rarely start the same way
export const variante =(id, sel, liste) => { let h = 0; for (const c of id + sel) h = (h * 31 + c.charCodeAt(0)) >>> 0; return liste[h % liste.length]; };
