// Reel of one place, for the regular posts (src/rubriques.mjs): Volcano Spotlight and On This Day (volcano or earthquake).
// Same look as the weekly reel (HebdoSeismes.jsx). One narration paragraph = one scene: hook on the globe, zoom on the place
// with its facts, the place seen from space (only when src/satellite.mjs found a clear view), end card.
// d: { compte "volcans" | "seismes", couleur, lon, lat, pastille, nom, sousTitre, ligneDate, coords, faits [[valeur, libelle]],
//      satLigne, date (top right) }
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { usePolices } from "./commun.jsx";
import { C, F, anneaux, clamp, ease, fait, fiche, globe, habillage, lerp, ligne, pastille, pays, voile } from "./HebdoSeismes.jsx";

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

// Volcano: a triangle with a glow; earthquake: the rings of the weekly reel
function repere(k, q, d, t) {
  if (!q) return;
  if (d.compte === "seismes") { anneaux(k, q, d.couleur, t); return; }
  for (const [r, a] of [[120, 0.16], [76, 0.32], [44, 0.6]]) { k.beginPath(); k.arc(q[0], q[1], r * (1 + 0.06 * Math.sin(t * 3)), 0, 7); k.strokeStyle = d.couleur; k.globalAlpha = a; k.lineWidth = 3; k.stroke(); }
  k.globalAlpha = 1; k.shadowColor = d.couleur; k.shadowBlur = 36;
  k.beginPath(); k.moveTo(q[0], q[1] - 26); k.lineTo(q[0] + 24, q[1] + 16); k.lineTo(q[0] - 24, q[1] + 16); k.closePath();
  k.fillStyle = d.couleur; k.fill(); k.shadowBlur = 0; k.lineWidth = 4; k.strokeStyle = "#0b141c"; k.stroke();
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

function image(k, G, img, sat, d, sc, t) {
  k.fillStyle = C.fond; k.fillRect(0, 0, 1080, 1920);
  const i = Math.max(0, sc.findIndex((s) => t < s.a)), s = sc[i] ?? sc.at(-1), x = (t - s.de) / (s.a - s.de), type = s.type;
  if (type === "accroche") {
    const v = { lon: lerp(d.lon - 50, d.lon, ease(x)), lat: lerp(0, Math.max(-35, Math.min(35, d.lat * 0.6)), ease(x)), cy: 620, R: 470 };
    const p = globe(k, G, v, []);
    k.globalAlpha = clamp(x * 3 - 0.8); repere(k, p([d.lon, d.lat]), d, t); k.globalAlpha = 1;
    voile(k);
    pastille(k, 70, 1050, d.pastille, d.couleur);
    ligne(k, d.nom, 66, 1250, 120, 800, "#fff");
    ligne(k, d.sousTitre ?? "", 70, 1340, 64, 700, d.couleur);
    ligne(k, d.ligneDate ?? "", 70, 1420, 56, 700, "#fff");
  } else if (type === "lieu") {
    const z = ease(clamp(x * 2.2)), v = { lon: d.lon, lat: lerp(Math.max(-35, Math.min(35, d.lat * 0.6)), d.lat, z), cy: 560, R: lerp(470, 2600, z), taille: 0.8 };
    const p = globe(k, G, v, []);
    pays(k, G, p, v);
    const q = p([d.lon, d.lat]); repere(k, q, d, t);
    fiche(k, q, [d.nom, d.coords, d.ligneDate ?? ""].filter(Boolean), d.couleur, x * 3 - 1.2);
    voile(k);
    k.globalAlpha = clamp(x * 3 - 0.4); pastille(k, 70, 1100, d.pastille, d.couleur); k.globalAlpha = 1;
    ligne(k, d.nom, 66, 1290, 96, 800, "#fff");
    d.faits.slice(0, 3).forEach(([valeur, libelle], j) => fait(k, 70, 1350 + j * 150, valeur, libelle, d.couleur, x * 3 - 0.8 - j * 0.4));
  } else if (type === "satellite" && sat) satellite(k, sat, d, x);
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
  const [h] = useState(() => delayRender("géographie, pastille et vue satellite"));
  useEffect(() => {
    const charger = (src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
    Promise.all([fetch(staticFile("geo/monde.json")).then((r) => r.json()), charger(staticFile(`pastilles/${d.compte}.svg`)),
      scenes.some((s) => s.type === "satellite") ? charger(staticFile(`${dossier}/satellite.jpg`)) : null])
      .then(([G, img, sat]) => { setRes({ G, img, sat }); continueRender(h); });
  }, [h]);
  useLayoutEffect(() => {
    if (!pret || !res || !ref.current) return;
    image(ref.current.getContext("2d"), res.G, res.img, res.sat, d, scenes, f < 2 ? couverture : f / 30);
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
