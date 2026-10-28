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
// Stable choice among wording variants: the same event always gets the same text, two events rarely start the same way
export const variante = (id, sel, liste) => { let h = 0; for (const c of id + sel) h = (h * 31 + c.charCodeAt(0)) >>> 0; return liste[h % liste.length]; };
