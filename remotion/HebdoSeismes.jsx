// Weekly reel "This Week in Earthquakes" for @LiveAtlasQuakes, after the validated "Weekly Quake Reel" mockup.
// Drawn on a canvas (same drawing as the mockup). One narration paragraph = one scene: hook, count by class, strongest,
// busiest spot, deepest and/or most felt, end card. Sound: calm voice, music under it, a soft whoosh between scenes.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { usePolices } from "./commun.jsx";

const C = { fond: "#0b141c", ocean: "#132a3d", terre: "#2a4c66", bord: "rgba(170,205,230,.45)", s1: "#F2D14B", s2: "#F2A93B", s3: "#FF6A4D", s4: "#E5303A", ambre: "#F2A93B", gris: "#b9c7d0" };
const F = { d: "Bricolage, sans-serif", b: "Plex, sans-serif", m: "Mono, monospace" };
const couleur = (m) => (m >= 7 ? C.s4 : m >= 6 ? C.s3 : m >= 5 ? C.s2 : C.s1);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
const clamp = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, x) => a + (b - a) * x;
const nf = new Intl.NumberFormat("en-US");
const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

function globe(k, G, v, dots) {
  const p = geoOrthographic().rotate([-v.lon, -v.lat]).translate([540, v.cy]).scale(v.R).clipAngle(90).precision(0.3);
  const g = geoPath(p, k);
  k.beginPath(); g({ type: "Sphere" }); k.fillStyle = C.ocean; k.fill();
  k.beginPath(); g(geoGraticule10()); k.strokeStyle = "rgba(242,169,59,.06)"; k.lineWidth = 1.5; k.stroke();
  k.beginPath(); g(G.TERRES); k.fillStyle = C.terre; k.fill(); k.strokeStyle = C.bord; k.lineWidth = 1.6; k.stroke();
  k.beginPath(); g(G.PLAQUES); k.strokeStyle = "rgba(242,169,59,.28)"; k.lineWidth = 2; k.setLineDash([10, 8]); k.stroke(); k.setLineDash([]);
  k.beginPath(); g({ type: "Sphere" }); k.strokeStyle = "rgba(242,169,59,.25)"; k.lineWidth = 2; k.stroke();
  for (const [lon, lat, m, a] of dots) {
    if (a <= 0 || geoDistance([lon, lat], [v.lon, v.lat]) > 1.5) continue;
    const q = p([lon, lat]); if (!q) continue;
    const r = (4 + Math.pow(m - 4, 1.7) * 7) * (v.taille || 1) * Math.min(1, a);
    k.globalAlpha = 0.85 * Math.min(1, a); k.shadowColor = couleur(m); k.shadowBlur = m >= 6 ? 24 : 0;
    k.beginPath(); k.arc(q[0], q[1], Math.max(0, r), 0, 7); k.fillStyle = couleur(m); k.fill();
    k.shadowBlur = 0; k.globalAlpha = 1;
  }
  return p;
}
// Country names in view, most important first, without overlap, in the map area only
function pays(k, G, p, v) {
  k.font = `600 38px ${F.b}`; k.textAlign = "center"; k.textBaseline = "middle";
  const pris = [[540 - 140, v.cy - 140, 540 + 140, v.cy + 140]];
  let n = 0;
  for (const [nom, x, y] of G.PAYS) {
    if (n >= 7 || geoDistance([x, y], [v.lon, v.lat]) > 1.2) continue;
    const q = p([x, y]); if (!q) continue;
    const w = k.measureText(nom).width, b = [q[0] - w / 2 - 10, q[1] - 26, q[0] + w / 2 + 10, q[1] + 26];
    if (b[0] < 30 || b[2] > 1050 || b[1] < 190 || b[3] > 980 || pris.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
    pris.push(b); n++;
    k.lineWidth = 6; k.strokeStyle = "rgba(19,42,61,.85)"; k.strokeText(nom, q[0], q[1]); k.fillStyle = "rgba(232,238,242,.8)"; k.fillText(nom, q[0], q[1]);
  }
}
function habillage(k, img, semaineDe) {
  k.strokeStyle = "rgba(232,238,242,.65)"; k.lineWidth = 4;
  for (const [x, y, sx, sy] of [[34, 34, 1, 1], [1046, 34, -1, 1], [34, 1886, 1, -1], [1046, 1886, -1, -1]]) { k.beginPath(); k.moveTo(x, y + 56 * sy); k.lineTo(x, y); k.lineTo(x + 56 * sx, y); k.stroke(); }
  // Round account badge of the page (pastilles/seismes.svg), as on the posts and the alert reel
  if (img) { k.save(); k.beginPath(); k.arc(102, 110, 26, 0, 7); k.clip(); k.drawImage(img, 76, 84, 52, 52); k.restore(); }
  k.fillStyle = "#fff"; k.font = `700 40px ${F.d}`; k.textAlign = "left"; k.textBaseline = "middle"; k.fillText("Live Atlas", 138, 110);
  k.font = `500 24px ${F.m}`; k.fillStyle = C.gris; k.textAlign = "right"; k.fillText(`WEEK OF ${semaineDe}`, 1010, 110);
}
function pastille(k, x, y, texte, col) {
  k.font = `800 40px ${F.d}`; const w = k.measureText(texte).width + 86;
  k.fillStyle = col; k.beginPath(); k.roundRect(x, y, w, 72, 36); k.fill();
  k.fillStyle = "#0b141c"; k.beginPath(); k.arc(x + 36, y + 36, 9, 0, 7); k.fill();
  k.textAlign = "left"; k.textBaseline = "middle"; k.fillText(texte, x + 58, y + 38);
}
function fait(k, x, y, valeur, libelle, col, a, colValeur = "#fff") {
  k.globalAlpha = clamp(a); k.fillStyle = col; k.fillRect(x, y + 6, 8, 84);
  k.fillStyle = colValeur; k.font = `800 76px ${F.d}`; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(valeur, x + 30, y + 66);
  k.fillStyle = "#c9d6df"; k.font = `600 34px ${F.b}`; k.fillText(libelle, x + 30, y + 112); k.globalAlpha = 1;
}
// Text on one line: font size reduced until it fits
function ligne(k, texte, x, y, taille, poids, col, largeur = 940) {
  let t = taille; do { k.font = `${poids} ${t}px ${F.d}`; t -= 2; } while (k.measureText(texte).width > largeur && t > 20);
  k.fillStyle = col; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(texte, x, y);
}
function fiche(k, q, lignes, col, a, haut = 150) {
  if (!q || a <= 0) return;
  k.globalAlpha = clamp(a); k.strokeStyle = col; k.lineWidth = 3; k.beginPath(); k.moveTo(q[0], q[1] + 34); k.lineTo(q[0], q[1] + haut); k.stroke();
  k.font = `800 60px ${F.d}`; const w0 = k.measureText(lignes[0]).width; k.font = `500 27px ${F.m}`;
  const w = Math.max(w0, ...lignes.slice(1).map((l) => k.measureText(l).width + l.length * 3.2)) + 56, h = 96 + (lignes.length - 1) * 42;
  const x = Math.max(60, Math.min(q[0] - 60, 1020 - w)), y = q[1] + haut;
  k.fillStyle = "rgba(11,20,28,.88)"; k.fillRect(x, y, w, h); k.strokeRect(x, y, w, h);
  k.fillStyle = col; k.font = `800 60px ${F.d}`; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(lignes[0], x + 28, y + 70);
  k.font = `500 27px ${F.m}`; k.fillStyle = "#e3eaef"; if ("letterSpacing" in k) k.letterSpacing = "3px";
  const tape = Math.floor(clamp(a * 1.4 - 0.2) * 40);
  lignes.slice(1).forEach((l, i) => k.fillText(l.toUpperCase().slice(0, tape), x + 28, y + 114 + i * 42));
  if ("letterSpacing" in k) k.letterSpacing = "0px"; k.globalAlpha = 1;
}
function anneaux(k, q, col, t) {
  if (!q) return;
  for (const [r, a, w] of [[150, 0.14, 2.5], [100, 0.28, 3], [62, 0.55, 3.5], [32, 0.9, 4]]) { k.beginPath(); k.arc(q[0], q[1], r * (1 + 0.06 * Math.sin(t * 3)), 0, 7); k.strokeStyle = col; k.globalAlpha = a; k.lineWidth = w; k.stroke(); }
  k.globalAlpha = 1; k.shadowColor = col; k.shadowBlur = 40; k.beginPath(); k.arc(q[0], q[1], 16, 0, 7); k.fillStyle = "#fff"; k.fill(); k.shadowBlur = 0;
}
function voile(k) {
  const gr = k.createLinearGradient(0, 0, 0, 1920);
  gr.addColorStop(0, "rgba(11,20,28,.8)"); gr.addColorStop(0.09, "rgba(11,20,28,0)"); gr.addColorStop(0.52, "rgba(11,20,28,0)"); gr.addColorStop(0.62, "rgba(11,20,28,.93)"); gr.addColorStop(0.7, C.fond); gr.addColorStop(1, C.fond);
  k.fillStyle = gr; k.fillRect(0, 0, 1080, 1920);
}
const miles = (km) => Math.round(km / 1.609344);

function profond(k, d, x) {
  const p = d.profond, max = Math.max(100, Math.ceil(p.mi / 100) * 100), dd = ease(clamp(x * 1.8 - 0.2)), y0 = 330, y1 = 1000, yp = y0 + (y1 - y0) * (p.mi / max), yq = lerp(y0, yp, dd);
  k.fillStyle = C.ocean; k.fillRect(0, 0, 1080, y0);
  const gr = k.createLinearGradient(0, y0, 0, y1 + 120); gr.addColorStop(0, "#3a2a22"); gr.addColorStop(1, "#5a2a1e"); k.fillStyle = gr; k.fillRect(0, y0, 1080, y1 + 120 - y0);
  k.fillStyle = C.terre; k.fillRect(0, y0 - 18, 1080, 18);
  k.strokeStyle = "rgba(255,255,255,.25)"; k.lineWidth = 2; k.font = `500 24px ${F.m}`; k.fillStyle = "rgba(255,255,255,.7)"; k.textAlign = "left"; k.textBaseline = "alphabetic";
  for (let mi = 0; mi <= max; mi += max > 300 ? 100 : 50) { const y = y0 + (y1 - y0) * (mi / max); k.beginPath(); k.moveTo(60, y); k.lineTo(110, y); k.stroke(); k.fillText(`${mi} mi`, 124, y + 8); }
  k.setLineDash([12, 10]); k.strokeStyle = C.s1; k.lineWidth = 4; k.beginPath(); k.moveTo(760, y0); k.lineTo(760, yq); k.stroke(); k.setLineDash([]);
  k.shadowColor = couleur(p.mag); k.shadowBlur = 40; k.beginPath(); k.arc(760, yq, 22, 0, 7); k.fillStyle = couleur(p.mag); k.fill(); k.shadowBlur = 0;
  k.fillStyle = "#fff"; k.font = `600 32px ${F.b}`; k.textAlign = "center"; k.fillText(p.region, 760, y0 - 40);
  voile(k);
  k.globalAlpha = clamp(x * 3 - 0.4); pastille(k, 70, 1100, "Deepest of the Week", C.s1); k.globalAlpha = 1;
  ligne(k, `${Math.round(p.mi * dd)} mi`, 56, 1380, 200, 800, C.s1);
  ligne(k, `Below ${p.region} (${p.km} km)`, 70, 1470, 60, 700, "#fff");
  fait(k, 70, 1530, `M${p.mag.toFixed(1)}`, `${p.jour}, ${p.lieu.replace(/, [^,]+$/, "")}`, couleur(p.mag), x * 3 - 1.2);
}
function ressenti(k, G, d, x, t, depuis) {
  const r = d.ressenti, z = ease(clamp(x * 2.2)), v = { lon: lerp(depuis[0], r.lon, z), lat: lerp(depuis[1], r.lat, z), cy: 560, R: lerp(depuis[2], 2400, z), taille: 0.8 };
  const p = globe(k, G, v, d.points.map(([a, b, m]) => [a, b, m, 0.5]));
  pays(k, G, p, v);
  const q = p([r.lon, r.lat]);
  if (q) for (let j = 0; j < 4; j++) { const ph = (t * 0.6 + j / 4) % 1; k.beginPath(); k.arc(q[0], q[1], 30 + ph * 260, 0, 7); k.strokeStyle = C.s1; k.globalAlpha = (1 - ph) * 0.7; k.lineWidth = 4; k.stroke(); }
  k.globalAlpha = 1; anneaux(k, q, C.s1, t);
  voile(k);
  k.globalAlpha = clamp(x * 3 - 0.4); pastille(k, 70, 1100, "Most Felt of the Week", C.s1); k.globalAlpha = 1;
  const n = nf.format(Math.round(r.felt * ease(clamp(x * 1.6 - 0.2))));
  k.font = `800 200px ${F.d}`; k.fillStyle = C.s1; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(n, 56, 1380);
  const l = k.measureText(nf.format(r.felt)).width; k.fillStyle = "#fff"; k.font = `800 ${l > 560 ? 60 : 76}px ${F.d}`; k.fillText("Felt Reports", 56 + l + 24, 1380);
  ligne(k, r.lieu, 70, 1470, 56, 700, "#fff");
  fait(k, 70, 1530, `M${r.mag.toFixed(1)}`, `${r.jour}, USGS “Did You Feel It?”`, C.s1, x * 3 - 1.2);
}

// t: seconds; sc: scenes [{type, de, a}] in seconds
function image(k, G, img, d, sc, t) {
  k.fillStyle = C.fond; k.fillRect(0, 0, 1080, 1920);
  const i = Math.max(0, sc.findIndex((s) => t < s.a)) , s = sc[i] ?? sc.at(-1), x = (t - s.de) / (s.a - s.de), type = s.type;
  const f = d.fort, a = d.actif;
  if (type === "accroche" || type === "classes") {
    const avance = type === "accroche" ? ease(x) : 1, lon = type === "accroche" ? lerp(f.lon - 40, f.lon + 15, x) : f.lon + 15 + x * 6;
    globe(k, G, { lon, lat: Math.max(-30, Math.min(30, f.lat * 0.4)), cy: 620, R: 470 }, d.points.map(([lo, la, m, tt]) => [lo, la, m, clamp((avance - tt * 0.9) * 8)]));
    voile(k);
    if (type === "accroche") {
      pastille(k, 70, 1050, "Weekly Report", C.ambre);
      k.fillStyle = "#fff"; k.font = `800 112px ${F.d}`; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText("This Week in", 66, 1250);
      const gr = k.createLinearGradient(66, 0, 760, 0); gr.addColorStop(0, C.s1); gr.addColorStop(0.45, C.s2); gr.addColorStop(1, C.s3);
      k.fillStyle = gr; k.fillText("Earthquakes", 66, 1360);
      k.fillStyle = "#fff"; k.font = `700 56px ${F.d}`; k.fillText(d.periode, 70, 1450);
      fait(k, 70, 1490, nf.format(Math.round(d.n * ease(x * 1.2))), "Quakes M4.5+ Worldwide", C.ambre, 1, C.ambre);
    } else {
      k.font = `800 96px ${F.d}`; k.textAlign = "left"; k.textBaseline = "alphabetic";
      k.fillStyle = C.ambre; k.fillText(String(d.n), 66, 1130); k.fillStyle = "#fff"; k.fillText(" Quakes", 66 + k.measureText(String(d.n)).width, 1130);
      k.fillStyle = C.gris; k.font = `600 40px ${F.b}`; k.fillText(`Magnitude 4.5 or More, ${d.periode.replace(/, \d{4}$/, "")}`, 70, 1190);
      const max = Math.max(...d.classes.map((c) => c[2]), 1), cols = [C.s4, C.s3, C.s2, C.s1];
      d.classes.forEach(([n, r, v], j) => {
        const aa = ease(clamp(x * 3 - j * 0.45)), y = 1260 + j * 110, L = 18 + 560 * (v / max) * aa;
        k.globalAlpha = Math.min(1, aa * 2);
        k.fillStyle = cols[j]; k.beginPath(); k.roundRect(330, y, L, 56, 8); k.fill();
        k.fillStyle = "#fff"; k.font = `800 46px ${F.d}`; k.textAlign = "left"; k.fillText(n, 70, y + 44);
        k.fillStyle = C.gris; k.font = `500 24px ${F.m}`; k.fillText(r, 70, y + 82);
        k.fillStyle = "#fff"; k.font = `800 46px ${F.d}`; k.fillText(nf.format(Math.round(v * aa)), 330 + L + 20, y + 44);
        k.globalAlpha = 1;
      });
    }
  } else if (type === "fort") {
    const z = ease(clamp(x * 2.2)), v = { lon: lerp(f.lon + 21, f.lon, z), lat: lerp(Math.max(-30, Math.min(30, f.lat * 0.4)), f.lat, z), cy: 560, R: lerp(470, 2600, z), taille: lerp(1, 0.8, z) };
    const p = globe(k, G, v, d.points.map(([lo, la, m]) => [lo, la, m, Math.abs(lo - f.lon) < 0.01 && Math.abs(la - f.lat) < 0.01 ? 0 : 0.5]));
    pays(k, G, p, v);
    const q = p([f.lon, f.lat]), col = couleur(f.mag); anneaux(k, q, col, t);
    fiche(k, q, [f.ville, `${f.jour} · ${f.heure}`, `${miles(f.prof)} mi (${Math.round(f.prof)} km) Deep`], col, x * 3 - 1.2);
    voile(k);
    const aa = clamp(x * 3 - 0.6);
    k.globalAlpha = aa; pastille(k, 70, 1100, "Strongest of the Week", col);
    k.fillStyle = col; k.font = `800 300px ${F.d}`; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(`M${f.mag.toFixed(1)}`, 52, 1440);
    ligne(k, f.lieu, 70, 1530, 60, 700, "#fff"); k.globalAlpha = 1;
    if (f.alerte === "orange" || f.alerte === "red") fait(k, 70, 1580, f.alerte === "red" ? "Red" : "Orange", "USGS Impact Level (PAGER)", f.alerte === "red" ? C.s4 : C.ambre, x * 3 - 1.4);
    else fait(k, 70, 1580, `${miles(f.prof)} mi`, `Deep (${Math.round(f.prof)} km)`, col, x * 3 - 1.4);
  } else if (type === "actif") {
    const z = ease(clamp(x * 2.2)), R = Math.max(1200, Math.min(4000, 260 / Math.max(a.etendue, 0.03)));
    const v = { lon: lerp(f.lon, a.centre[0], z), lat: lerp(f.lat, a.centre[1], z), cy: 560, R: lerp(2600, R, z), taille: 0.7 };
    const actifs = d.points.filter((p) => p[4]).sort((p1, p2) => p1[3] - p2[3]), n = Math.round(a.n * ease(clamp(x * 1.6 - 0.3)));
    const p = globe(k, G, v, [...d.points.filter((p) => !p[4]).map(([lo, la, m]) => [lo, la, m, 0.5]), ...actifs.map(([lo, la, m], j) => [lo, la, m, j < n ? 1 : 0])]);
    pays(k, G, p, v);
    voile(k);
    k.globalAlpha = clamp(x * 3 - 0.4); pastille(k, 70, 1100, "Busiest Spot", C.s3); k.globalAlpha = 1;
    k.fillStyle = "#fff"; k.font = `800 200px ${F.d}`; k.textAlign = "left"; k.textBaseline = "alphabetic"; k.fillText(String(n), 56, 1380);
    const l = k.measureText(String(a.n)).width; k.font = `800 76px ${F.d}`; k.fillText("Quakes", 56 + l + 24, 1380);
    ligne(k, `Around ${a.nom}`, 70, 1470, 60, 700, C.s3);
    fait(k, 70, 1530, `M${a.max.toFixed(1)}`, `Strongest There, ${a.jourDuMax}`, couleur(a.max), x * 3 - 1.2);
    if (a.nJourMax >= 10) fait(k, 560, 1530, String(a.nJourMax), `On ${a.jourMax} Alone`, C.s3, x * 3 - 1.6);
  } else if (type === "profond") profond(k, d, x);
  else if (type === "ressenti") ressenti(k, G, d, x, t, sc.some((z) => z.type === "profond") ? [d.ressenti.lon - 30, 0, 470] : [a.centre[0], a.centre[1], 1800]);
  else {
    const aa = ease(clamp(x * 2));
    globe(k, G, { lon: f.lon + 15 + x * 20, lat: 0, cy: 700, R: 430 }, d.points.map(([lo, la, m]) => [lo, la, m, 0.9]));
    k.fillStyle = "rgba(11,20,28,.55)"; k.fillRect(0, 0, 1080, 1920);
    k.globalAlpha = aa;
    // Round badge with coral rings, as on the alert reel end card
    const fr = (t - s.de) * 30, cy = 650 - 30 * (1 - aa);
    k.lineWidth = 5; k.strokeStyle = C.s3;
    for (const r of [0, 1, 2]) { const a = ((fr + r * 22) % 66) / 66; k.globalAlpha = aa * (1 - a) * 0.6; k.beginPath(); k.arc(540, cy, 150 + a * 165, 0, 7); k.stroke(); }
    k.globalAlpha = aa;
    if (img) { k.save(); k.beginPath(); k.arc(540, cy, 150, 0, 7); k.clip(); k.drawImage(img, 390, cy - 150, 300, 300); k.restore(); }
    k.fillStyle = "#fff"; k.font = `800 96px ${F.d}`; k.textAlign = "center"; k.textBaseline = "alphabetic";
    k.fillText("Every Quake", 540, 1000); k.fillStyle = C.ambre; k.fillText("That Matters", 540, 1100);
    k.fillStyle = "rgba(232,238,242,.12)"; k.beginPath(); k.roundRect(300, 1170, 480, 72, 36); k.fill();
    k.fillStyle = "#dfe7ec"; k.font = `600 38px ${F.b}`; k.fillText("@LiveAtlasQuakes", 540, 1220);
    k.globalAlpha = 1;
  }
  habillage(k, img, d.semaineDe);
}

export const HebdoSeismes = ({ d, scenes, audio, couverture }) => {
  const f = useCurrentFrame(), pret = usePolices(), ref = useRef(null);
  const [G, setG] = useState(null), [img, setImg] = useState(null);
  const [h] = useState(() => delayRender("géographie et pastille"));
  useEffect(() => {
    const im = new Image(); im.src = staticFile("pastilles/seismes.svg");
    Promise.all([fetch(staticFile("geo/monde.json")).then((r) => r.json()), new Promise((ok) => { im.onload = () => ok(im); im.onerror = () => ok(null); })])
      .then(([g, i]) => { setG(g); setImg(i); continueRender(h); });
  }, [h]);
  useLayoutEffect(() => {
    if (!pret || !G || !d || !ref.current) return;
    const k = ref.current.getContext("2d");
    image(k, G, img, d, scenes, f < 2 ? couverture : f / 30);
  });
  const parle = (fr) => audio.parle.some(([a, b]) => fr >= a - 6 && fr <= b + 6);
  return (
    <AbsoluteFill style={{ background: C.fond }}>
      <canvas ref={ref} width={1080} height={1920} style={{ width: 1080, height: 1920 }} />
      {audio.voix && <Sequence from={audio.voixDebut}><Audio src={staticFile(audio.voix)} /></Sequence>}
      {audio.musique && <Audio src={staticFile(audio.musique)} volume={(fr) => (parle(fr) ? 0.14 : 0.45) * interpolate(fr, [audio.fin - 45, audio.fin], [1, 0], CL)} />}
      {scenes.slice(1).map((s, i) => <Sequence key={i} from={Math.max(0, Math.round(s.de * 30) - 6)} durationInFrames={40}><Audio src={staticFile("sons/whoosh.wav")} volume={0.15} /></Sequence>)}
    </AbsoluteFill>
  );
};
