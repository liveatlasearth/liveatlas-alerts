// Reel of one place, for the regular posts (src/rubriques.mjs): Volcano Spotlight and On This Day (volcano or earthquake).
// Same look as the weekly reel (HebdoSeismes.jsx). One narration paragraph = one scene, each scene carries its own data:
//   media      a real photo or video full frame (Wikimedia Commons, src/medias.mjs) with a big figure, title and credit;
//              the first scene is the hook (punch-in, a shake for earthquakes, a blast or a rumble on frame 0)
//   lieu       zoom on the place, names of the countries, US states and seas around it, the facts of the post
//   chiffres   up to three figures counting up, and the causes of death as chips
//   frise      every eruption of the volcano on a time line (Smithsonian GVP), the deadly ones (NOAA NCEI) in red
//   secousses  the shaking zones of the earthquake (USGS ShakeMap) appearing one after the other, the cities named
//   repliques  the aftershocks appearing day after day on the map (USGS catalog), the camera slowly moving in
//   satellite  the place seen from space (src/satellite.mjs), only when a clear view was found
//   fin        end card
// d: { compte "volcans" | "seismes", couleur, lon, lat, pastille, nom, sousTitre, ligneDate, coords, faits [[valeur, libelle]],
//      satLigne, date (top right) }
// (rewritten on Nov 5, 2026: 30–45 s, real images, history, sound effects, after the user found the first version flat)
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { geoDistance, geoPath } from "d3-geo";
import { usePolices } from "./commun.jsx";
import { C, F, anneaux, clamp, ease, fait, fiche, globe, habillage, lerp, ligne, pastille, voile } from "./HebdoSeismes.jsx";

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const nf = new Intl.NumberFormat("en-US");

// Volcano: a triangle with a glow; earthquake: the rings of the weekly reel
function repere(k, q, d, t) {
  if (!q) return;
  if (d.compte === "seismes") { anneaux(k, q, d.couleur, t); return; }
  for (const [r, a] of [[120, 0.16], [76, 0.32], [44, 0.6]]) { k.beginPath(); k.arc(q[0], q[1], r * (1 + 0.06 * Math.sin(t * 3)), 0, 7); k.strokeStyle = d.couleur; k.globalAlpha = a; k.lineWidth = 3; k.stroke(); }
  k.globalAlpha = 1; k.shadowColor = d.couleur; k.shadowBlur = 36;
  k.beginPath(); k.moveTo(q[0], q[1] - 26); k.lineTo(q[0] + 24, q[1] + 16); k.lineTo(q[0] - 24, q[1] + 16); k.closePath();
  k.fillStyle = d.couleur; k.fill(); k.shadowBlur = 0; k.lineWidth = 4; k.strokeStyle = "#0b141c"; k.stroke();
}

// Names around the place, so the viewer knows where it is: countries, then seas (italic, blue) and US states (small),
// most important first, without overlap, inside the map area
function noms(k, G, E, p, v) {
  const pris = [[540 - 120, v.cy - 120, 540 + 120, v.cy + 120]];
  const liste = [
    ...G.PAYS.map(([nom, x, y, rang]) => ({ nom, x, y, rang: rang ?? 3, sorte: "pays" })),
    ...E.MERS.map(([nom, x, y, rang]) => ({ nom, x, y, rang: rang + 0.5, sorte: "mer" })),
    ...E.ETATS.map(([nom, x, y]) => ({ nom, x, y, rang: 4, sorte: "etat" })),
  ].sort((a, b) => a.rang - b.rang);
  let n = 0;
  for (const l of liste) {
    if (n >= 9 || geoDistance([l.x, l.y], [v.lon, v.lat]) > 1.1) continue;
    const q = p([l.x, l.y]); if (!q) continue;
    k.font = l.sorte === "mer" ? `italic 500 34px ${F.b}` : l.sorte === "etat" ? `600 28px ${F.b}` : `600 38px ${F.b}`;
    if ("letterSpacing" in k) k.letterSpacing = l.sorte === "mer" ? "2px" : "0px";
    const w = k.measureText(l.nom).width, b = [q[0] - w / 2 - 10, q[1] - 24, q[0] + w / 2 + 10, q[1] + 24];
    if (b[0] < 30 || b[2] > 1050 || b[1] < 190 || b[3] > 980 || pris.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
    pris.push(b); n++;
    k.textAlign = "center"; k.textBaseline = "middle"; k.lineWidth = 6; k.strokeStyle = "rgba(19,42,61,.85)"; k.strokeText(l.nom, q[0], q[1]);
    k.fillStyle = l.sorte === "mer" ? "rgba(140,190,225,.9)" : l.sorte === "etat" ? "rgba(232,238,242,.62)" : "rgba(232,238,242,.85)"; k.fillText(l.nom, q[0], q[1]);
  }
  if ("letterSpacing" in k) k.letterSpacing = "0px";
}

// Photo full frame (cover), slowly closing in; the first scene punches in and, for an earthquake, shakes
function photo(k, img, x, d, s, accroche, t0) {
  const z = lerp(1.04, 1.16, ease(x)) * (accroche ? 1 + 0.12 * Math.max(0, 1 - t0 / 0.35) : 1);
  const tremble = accroche && d.compte === "seismes" ? 26 * Math.max(0, 1 - t0 / 1.4) : 0;
  const dx = tremble * Math.sin(t0 * 71), dy = tremble * Math.cos(t0 * 53);
  if (img) {
    const r = Math.max(1080 / img.width, 1920 / img.height) * z, w = img.width * r, h = img.height * r;
    k.drawImage(img, 540 - w / 2 + dx + lerp(0, -30, x), (s.haut ? 0 : 960 - h / 2) + dy, w, h);
  }
}
function textesMedia(k, s, d, x, t0) {
  const gr = k.createLinearGradient(0, 0, 0, 1920);
  gr.addColorStop(0, "rgba(11,20,28,.75)"); gr.addColorStop(0.12, "rgba(11,20,28,0)"); gr.addColorStop(0.5, "rgba(11,20,28,0)"); gr.addColorStop(0.72, "rgba(11,20,28,.85)"); gr.addColorStop(1, "rgba(11,20,28,.97)");
  k.fillStyle = gr; k.fillRect(0, 0, 1080, 1920);
  const a = (de) => clamp((t0 - de) * 3.5);
  k.globalAlpha = a(0.05); if (s.sur) pastille(k, 70, 1230, s.sur, d.couleur);
  if (s.grand) { k.globalAlpha = a(0.15); const y = 1500 + 30 * (1 - ease(a(0.15))); ligne(k, s.grand, 62, y, 230, 800, d.couleur, 950); }
  k.globalAlpha = a(0.35); if (s.titre) ligne(k, s.titre, 66, 1610, 78, 800, "#fff");
  k.globalAlpha = a(0.55); if (s.sous) ligne(k, s.sous, 70, 1685, 44, 600, "#dfe7ec");
  if (s.credit) { k.globalAlpha = 0.75 * a(0.3); k.font = `500 21px ${F.m}`; k.fillStyle = "#c9d6df"; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(s.credit.toUpperCase(), 70, 1800, 940); }
  k.globalAlpha = 1;
}

// Figures counting up, and chips (causes of death)
function chiffres(k, G, s, d, x, t0, t, fond) {
  // Behind the figures: the photo of the hook, blurred and dark, else the turning globe
  if (fond) { k.filter = "blur(22px)"; const r = Math.max(1080 / fond.width, 1920 / fond.height) * (1.15 + 0.05 * x); k.drawImage(fond, 540 - (fond.width * r) / 2, 960 - (fond.height * r) / 2, fond.width * r, fond.height * r); k.filter = "none"; k.fillStyle = "rgba(11,20,28,.62)"; k.fillRect(0, 0, 1080, 1920); }
  else { globe(k, G, { lon: d.lon + 10 + t0 * 2, lat: Math.max(-35, Math.min(35, d.lat * 0.6)), cy: 520, R: 420 }, []); k.fillStyle = "rgba(11,20,28,.72)"; k.fillRect(0, 0, 1080, 1920); }
  k.globalAlpha = clamp(t0 * 3); if (s.sur) pastille(k, 70, 820, s.sur, d.couleur); k.globalAlpha = 1;
  (s.items ?? []).slice(0, 3).forEach(([n, libelle, avant = "", apres = ""], j) => {
    const a = clamp((t0 - 0.2 - j * 0.45) * 3), v = typeof n === "number" ? Math.round(n * ease(clamp((t0 - 0.2 - j * 0.45) / 1.1))) : n;
    k.globalAlpha = a; k.fillStyle = j ? "#fff" : d.couleur; k.font = `800 ${j ? 120 : 170}px ${F.d}`; k.textAlign = "left"; k.textBaseline = "alphabetic";
    const y = 1080 + (j ? 130 + j * 190 : 0);
    k.fillText(`${avant}${typeof v === "number" ? nf.format(v) : v}${apres}`, 66, y);
    k.fillStyle = "#c9d6df"; k.font = `600 40px ${F.b}`; k.fillText(libelle, 72, y + 58);
  });
  let cx = 70, cy = 1730;
  (s.puces ?? []).forEach((p, j) => {
    k.globalAlpha = clamp((t0 - 1.2 - j * 0.25) * 3); k.font = `700 34px ${F.b}`; const w = k.measureText(p).width + 50;
    if (cx + w > 1010) { cx = 70; cy += 78; }
    k.fillStyle = "rgba(229,48,58,.22)"; k.strokeStyle = "#E5303A"; k.lineWidth = 2; k.beginPath(); k.roundRect(cx, cy - 46, w, 62, 31); k.fill(); k.stroke();
    k.fillStyle = "#fff"; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(p, cx + 25, cy - 4); cx += w + 16;
  });
  k.globalAlpha = 1;
}

// Every eruption on a time line, swept from left to right
function frise(k, s, d, x, t0) {
  k.fillStyle = C.fond; k.fillRect(0, 0, 1080, 1920);
  const [a0, a1] = s.bornes, X = (an) => 80 + ((an - a0) / (a1 - a0)) * 920, base = 1180, balai = lerp(a0, a1, ease(clamp((t0 - 0.3) / Math.max(1.5, (s.duree ?? 6) * 0.6))));
  k.globalAlpha = clamp(t0 * 3); if (s.sur) pastille(k, 70, 330, s.sur, d.couleur);
  ligne(k, s.titre ?? "", 66, 520, 84, 800, "#fff");
  if (s.sous) ligne(k, s.sous, 70, 590, 42, 600, "#c9d6df");
  k.strokeStyle = "rgba(232,238,242,.35)"; k.lineWidth = 3; k.beginPath(); k.moveTo(80, base); k.lineTo(1000, base); k.stroke();
  k.font = `500 26px ${F.m}`; k.fillStyle = C.gris; k.textAlign = "center"; k.textBaseline = "top";
  for (const an of s.graduations ?? []) { k.fillText(String(an), X(an), base + 18); k.fillRect(X(an) - 1, base, 2, 12); }
  let n = 0;
  for (const [an, vei, morts, cle] of s.points) {
    if (an > balai) continue; if (an > (s.depuisAn ?? -1e9)) n++;
    const h = 40 + (vei ?? 1) * 52, c = cle ? d.couleur : morts ? "#E5303A" : "rgba(242,169,59,.55)";
    const pop = ease(clamp((balai - an) / ((a1 - a0) * 0.04)));
    k.fillStyle = c; k.fillRect(X(an) - (cle ? 5 : 3), base - h * pop, cle ? 10 : 6, h * pop);
    if (morts || cle) { k.beginPath(); k.arc(X(an), base - h * pop, cle ? 14 : 9, 0, 7); k.fill(); }
  }
  // Labels of the highlighted eruptions (this one, the deadliest, the last), once the sweep has passed them
  for (const [an, texte, haut] of s.etiquettes ?? []) {
    if (an > balai) continue;
    k.globalAlpha = clamp((balai - an) / ((a1 - a0) * 0.05)); k.font = `700 32px ${F.b}`; k.textAlign = "center"; k.textBaseline = "alphabetic";
    const w = k.measureText(texte).width, xx = Math.max(40 + w / 2, Math.min(1040 - w / 2, X(an))), y = base - haut;
    k.strokeStyle = "rgba(232,238,242,.4)"; k.lineWidth = 2; k.beginPath(); k.moveTo(X(an), y + 10); k.lineTo(X(an), base - 30); k.stroke();
    k.fillStyle = "rgba(11,20,28,.9)"; k.fillRect(xx - w / 2 - 14, y - 38, w + 28, 52); k.fillStyle = "#fff"; k.fillText(texte, xx, y);
  }
  k.globalAlpha = clamp(t0 * 3);
  k.fillStyle = d.couleur; k.font = `800 200px ${F.d}`; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(String(n), 66, 1520);
  k.fillStyle = "#fff"; k.font = `700 48px ${F.b}`; k.fillText(s.compte ?? "Eruptions", 70, 1590);
  k.globalAlpha = 1;
}

// Aftershocks appearing day after day around the epicenter
function repliques(k, G, E, s, d, x, t0, t) {
  const v = { lon: d.lon, lat: d.lat, cy: 620, R: (s.R ?? 2600) * lerp(0.88, 1.15, ease(x)), taille: 0.8 }; // slow camera push-in
  const p = globe(k, G, v, []);
  noms(k, G, E, p, v);
  const jour = s.jours * ease(clamp((t0 - 0.3) / Math.max(1.5, (s.duree ?? 6) * 0.7))), vus = s.points.filter(([, , , j]) => j <= jour);
  for (const [lon, lat, m, j] of vus) {
    const q = p([lon, lat]); if (!q) continue;
    const a = clamp((jour - j) * 2), r = 5 + (m - 4) * 6;
    k.globalAlpha = 0.8 * a; k.fillStyle = m >= 6 ? C.s3 : m >= 5 ? C.s2 : C.s1; k.beginPath(); k.arc(q[0], q[1], r, 0, 7); k.fill();
  }
  k.globalAlpha = 1; repere(k, p([d.lon, d.lat]), d, t);
  if (s.depuis && t0 > (s.duree ?? 6) * 0.65) {
    const q = p([s.depuis.lon, s.depuis.lat]);
    if (q) { k.globalAlpha = clamp((t0 - (s.duree ?? 6) * 0.65) * 3); anneaux(k, q, "#fff", t); fiche(k, q, [s.depuis.titre, s.depuis.ligne], "#fff", 1, 110); k.globalAlpha = 1; }
  }
  voile(k);
  k.globalAlpha = clamp(t0 * 3); if (s.sur) pastille(k, 70, 1100, s.sur, d.couleur);
  k.fillStyle = d.couleur; k.font = `800 200px ${F.d}`; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(nf.format(vus.length), 66, 1420);
  k.fillStyle = "#fff"; k.font = `700 48px ${F.b}`; k.fillText(s.titre, 70, 1495);
  k.font = `500 30px ${F.m}`; k.fillStyle = C.gris; if ("letterSpacing" in k) k.letterSpacing = "3px";
  k.fillText(`DAY ${Math.max(1, Math.ceil(jour))} OF ${s.jours}`, 70, 1560); if ("letterSpacing" in k) k.letterSpacing = "0px";
  k.globalAlpha = 1;
}

// Shaking of the earthquake (USGS ShakeMap contours, as on the alert reels): the zones appear from the weakest to the strongest,
// the camera slowly moves in, the PAGER cities are named
const MMI = { 4: "#80ffff", 5: "#7cff90", 6: "#ffff00", 7: "#ffc600", 8: "#ff9100", 9: "#ff0000", 10: "#c80000" };
const ROMAIN = { 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X" };
function secousses(k, G, E, S, s, d, x, t0, t) {
  const v = { lon: d.lon, lat: d.lat, cy: 600, R: s.R * lerp(0.85, 1.12, ease(x)), taille: 0.8 };
  const p = globe(k, G, v, []), g = geoPath(p, k);
  noms(k, G, E, p, v);
  const zones = [...(S?.cont ?? [])].sort((a, b) => a.properties.mmi - b.properties.mmi), niveaux = [...new Set(zones.map((z) => z.properties.mmi))];
  for (const z of zones) {
    const a = clamp((t0 * 1.6 - niveaux.indexOf(z.properties.mmi) * 0.45) * 2); if (a <= 0) continue;
    k.globalAlpha = a; k.beginPath(); g(z); k.strokeStyle = MMI[z.properties.mmi] ?? "#fff"; k.lineWidth = 6; k.shadowColor = k.strokeStyle; k.shadowBlur = 14; k.stroke();
  }
  k.shadowBlur = 0; k.globalAlpha = 1;
  repere(k, p([d.lon, d.lat]), d, t);
  const places = [];
  (s.villes ?? []).slice(0, 4).forEach((c, j) => {
    const q = p([c.lon, c.lat]); if (!q || q[1] > 1000 || places.some((o) => Math.abs(o[0] - q[0]) < 260 && Math.abs(o[1] - q[1]) < 60)) return; // names never on top of each other
    places.push(q);
    k.globalAlpha = clamp((t0 - 1 - j * 0.4) * 3);
    k.beginPath(); k.arc(q[0], q[1], 10, 0, 7); k.fillStyle = "#fff"; k.fill(); k.lineWidth = 3; k.strokeStyle = "#0b141c"; k.stroke();
    k.font = `700 32px ${F.d}`; k.textAlign = "left"; k.textBaseline = "middle"; k.lineWidth = 7; k.strokeStyle = "rgba(11,20,28,.9)"; k.strokeText(c.nom, q[0] + 18, q[1]); k.fillStyle = "#fff"; k.fillText(c.nom, q[0] + 18, q[1]);
  });
  k.globalAlpha = 1; voile(k);
  k.globalAlpha = clamp(t0 * 3); if (s.sur) pastille(k, 70, 1100, s.sur, d.couleur);
  k.fillStyle = MMI[s.mmi] ?? d.couleur; ligne(k, s.mot.replace(/\b\w/g, (c) => c.toUpperCase()), 62, 1330, 170, 800, MMI[s.mmi] ?? d.couleur, 950);
  k.fillStyle = "#fff"; k.font = `700 48px ${F.b}`; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText("Strongest Shaking", 70, 1410);
  k.font = `500 30px ${F.m}`; k.fillStyle = C.gris; if ("letterSpacing" in k) k.letterSpacing = "3px";
  k.fillText(`INTENSITY ${ROMAIN[s.mmi] ?? s.mmi} · USGS SHAKEMAP`, 70, 1475); if ("letterSpacing" in k) k.letterSpacing = "0px";
  k.globalAlpha = 1;
}

// The satellite view (1080 × 1350) fills the 1080 × 1920 frame and slowly closes in on the summit
function satellite(k, sat, d, x) {
  const z = lerp(1920 / 1350, (1920 / 1350) * 1.25, ease(x)), w = 1080 * z, h = 1350 * z;
  k.drawImage(sat, 540 - w / 2, 960 - h / 2, w, h);
  const r = 74 * z / (1920 / 1350), b = 26;
  k.strokeStyle = d.couleur; k.lineWidth = 5;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { k.beginPath(); k.moveTo(540 + sx * r, 960 + sy * (r - b)); k.lineTo(540 + sx * r, 960 + sy * r); k.lineTo(540 + sx * (r - b), 960 + sy * r); k.stroke(); }
  const gr = k.createLinearGradient(0, 0, 0, 1920);
  gr.addColorStop(0, "rgba(11,20,28,.8)"); gr.addColorStop(0.1, "rgba(11,20,28,0)"); gr.addColorStop(0.7, "rgba(11,20,28,0)"); gr.addColorStop(0.86, "rgba(11,20,28,.9)"); gr.addColorStop(1, C.fond);
  k.fillStyle = gr; k.fillRect(0, 0, 1080, 1920);
  k.globalAlpha = clamp(x * 4 - 0.3); pastille(k, 70, 1500, "Seen From Space", d.couleur);
  ligne(k, d.nom, 66, 1680, 110, 800, "#fff");
  k.font = `500 30px ${F.m}`; k.fillStyle = "#e3eaef"; k.textAlign = "left"; if ("letterSpacing" in k) k.letterSpacing = "3px";
  k.fillText(d.satLigne.toUpperCase(), 70, 1750); if ("letterSpacing" in k) k.letterSpacing = "0px"; k.globalAlpha = 1;
}

function image(k, R, d, sc, t) {
  const { G, E, S, img, sat, medias } = R;
  const i = Math.max(0, sc.findIndex((s) => t < s.a)), s = sc[i] ?? sc.at(-1), x = (t - s.de) / (s.a - s.de), t0 = t - s.de, type = s.type;
  if (type === "media" && s.video) k.clearRect(0, 0, 1080, 1920);
  else { k.fillStyle = C.fond; k.fillRect(0, 0, 1080, 1920); }
  if (type === "media") { if (!s.video) photo(k, medias[i], x, d, s, i === 0, t0); textesMedia(k, s, d, x, t0); }
  else if (type === "accroche") {
    const v = { lon: lerp(d.lon - 50, d.lon, ease(x)), lat: lerp(0, Math.max(-35, Math.min(35, d.lat * 0.6)), ease(x)), cy: 620, R: 470 };
    const p = globe(k, G, v, []);
    k.globalAlpha = clamp(x * 3 - 0.8); repere(k, p([d.lon, d.lat]), d, t); k.globalAlpha = 1;
    voile(k);
    pastille(k, 70, 1050, d.pastille, d.couleur);
    ligne(k, d.nom, 66, 1250, 120, 800, "#fff");
    ligne(k, d.sousTitre ?? "", 70, 1340, 64, 700, d.couleur);
    ligne(k, d.ligneDate ?? "", 70, 1420, 56, 700, "#fff");
  } else if (type === "lieu") {
    const z = ease(clamp(t0 / 1.6)), v = { lon: lerp(d.lon - 25, d.lon, z), lat: lerp(Math.max(-35, Math.min(35, d.lat * 0.6)), d.lat, z), cy: 560, R: lerp(470, s.R ?? 2600, z), taille: 0.8 };
    const p = globe(k, G, v, []);
    if (z > 0.6) { k.globalAlpha = clamp((z - 0.6) * 4); noms(k, G, E, p, v); k.globalAlpha = 1; }
    const q = p([d.lon, d.lat]); repere(k, q, d, t);
    fiche(k, q, [d.nom, d.coords, d.ligneDate ?? ""].filter(Boolean), d.couleur, t0 * 2 - 2.6);
    voile(k);
    k.globalAlpha = clamp(t0 * 2 - 0.4); pastille(k, 70, 1100, s.sur ?? d.pastille, d.couleur); k.globalAlpha = 1;
    ligne(k, d.nom, 66, 1290, 96, 800, "#fff");
    (s.faits ?? d.faits).slice(0, 3).forEach(([valeur, libelle], j) => fait(k, 70, 1350 + j * 150, valeur, libelle, d.couleur, t0 * 2 - 1.2 - j * 0.5));
  } else if (type === "chiffres") chiffres(k, G, s, d, x, t0, t, medias.find(Boolean) ?? sat);
  else if (type === "frise") frise(k, { ...s, duree: s.a - s.de }, d, x, t0);
  else if (type === "secousses") secousses(k, G, E, S, s, d, x, t0, t);
  else if (type === "repliques") repliques(k, G, E, { ...s, duree: s.a - s.de }, d, x, t0, t);
  else if (type === "satellite" && sat) satellite(k, sat, d, x);
  else {
    const aa = ease(clamp(x * 2));
    globe(k, G, { lon: d.lon + 15 + x * 20, lat: 0, cy: 700, R: 430 }, []);
    k.fillStyle = "rgba(11,20,28,.55)"; k.fillRect(0, 0, 1080, 1920);
    // Round badge of the account with rings, as on the other reels
    const fr = (t - s.de) * 30, cy = 650 - 30 * (1 - aa);
    k.lineWidth = 5; k.strokeStyle = d.couleur;
    for (const r of [0, 1, 2]) { const a = ((fr + r * 22) % 66) / 66; k.globalAlpha = aa * (1 - a) * 0.6; k.beginPath(); k.arc(540, cy, 150 + a * 165, 0, 7); k.stroke(); }
    k.globalAlpha = aa;
    if (img) { k.save(); k.beginPath(); k.arc(540, cy, 150, 0, 7); k.clip(); k.drawImage(img, 390, cy - 150, 300, 300); k.restore(); }
    const [l1, l2, compte] = d.compte === "seismes" ? ["Every Quake", "That Matters", "@LiveAtlasQuakes"] : ["Every Eruption", "That Matters", "@LiveAtlasErupts"];
    k.fillStyle = "#fff"; k.font = `800 96px ${F.d}`; k.textAlign = "center"; k.textBaseline = "alphabetic";
    k.fillText(l1, 540, 1000); k.fillStyle = d.couleur; k.fillText(l2, 540, 1100);
    k.fillStyle = "rgba(232,238,242,.12)"; k.beginPath(); k.roundRect(300, 1170, 480, 72, 36); k.fill();
    k.fillStyle = "#dfe7ec"; k.font = `600 38px ${F.b}`; k.fillText(compte, 540, 1220);
    k.globalAlpha = 1;
  }
  habillage(k, img, d.date);
}

export const ReelLieu = ({ dossier, d, scenes, audio, couverture }) => {
  const f = useCurrentFrame(), pret = usePolices(), ref = useRef(null);
  const [res, setRes] = useState(null);
  const [h] = useState(() => delayRender("géographie, pastille, photos et vue satellite"));
  useEffect(() => {
    const charger = (src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
    const lire = (f) => fetch(staticFile(f)).then((r) => r.json());
    Promise.all([lire("geo/monde.json"), lire("geo/etiquettes.json"), charger(staticFile(`pastilles/${d.compte}.svg`)),
      scenes.some((s) => s.type === "satellite") ? charger(staticFile(`${dossier}/satellite.jpg`)) : null,
      Promise.all(scenes.map((s) => (s.type === "media" && !s.video ? charger(staticFile(s.fichier)) : null))),
      scenes.some((s) => s.type === "secousses") ? lire(`${dossier}/secousses.json`) : null])
      .then(([G, E, img, sat, medias, S]) => { setRes({ G, E, img, sat, medias, S }); continueRender(h); });
  }, [h]);
  useLayoutEffect(() => {
    if (!pret || !res || !ref.current) return;
    image(ref.current.getContext("2d"), res, d, scenes, f < 2 ? couverture : f / 30);
  });
  const parle = (fr) => audio.parle.some(([a, b]) => fr >= a - 6 && fr <= b + 6);
  const fr = (s) => Math.max(0, Math.round(s.de * 30));
  return (
    <AbsoluteFill style={{ background: C.fond }}>
      {scenes.map((s, i) => s.type === "media" && s.video ? (
        <Sequence key={`v${i}`} from={fr(s)} durationInFrames={Math.max(1, Math.round((s.a - s.de) * 30))}>
          <AbsoluteFill><OffthreadVideo src={staticFile(s.fichier)} muted style={{ width: 1080, height: 1920, objectFit: "cover" }} /></AbsoluteFill>
        </Sequence>) : null)}
      <AbsoluteFill><canvas ref={ref} width={1080} height={1920} style={{ width: 1080, height: 1920 }} /></AbsoluteFill>
      {audio.voix && <Sequence from={audio.voixDebut}><Audio src={staticFile(audio.voix)} /></Sequence>}
      {audio.musique && <Audio src={staticFile(audio.musique)} volume={(x) => (parle(x) ? 0.11 : 0.4) * interpolate(x, [0, 20, audio.fin - 45, audio.fin], [0.3, 1, 1, 0], CL)} />}
      {/* Sound effects of each scene ([file, volume, seconds]) and a soft whoosh between scenes */}
      {scenes.flatMap((s, i) => (s.sons ?? []).map(([son, vol, duree], j) => (
        <Sequence key={`s${i}-${j}`} from={fr(s)} durationInFrames={Math.round((duree ?? 6) * 30)}>
          <Audio src={staticFile(son)} volume={(x) => vol * interpolate(x, [0, Math.round((duree ?? 6) * 30) - 30, Math.round((duree ?? 6) * 30)], [1, 1, 0], CL) * (parle(x + fr(s)) ? 0.55 : 1)} />
        </Sequence>)))}
      {scenes.slice(1).map((s, i) => <Sequence key={i} from={Math.max(0, fr(s) - 6)} durationInFrames={40}><Audio src={staticFile("sons/whoosh.wav")} volume={0.15} /></Sequence>)}
    </AbsoluteFill>
  );
};
