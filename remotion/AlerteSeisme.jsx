// Earthquake alert reel for @LiveAtlasQuakes, after the validated Live Atlas templates.
// One scene per narration paragraph: hook, essentials, satellite view, shaking zones, what to do, end card.
// Data: public/evenements/<id>/donnees.json (src/donnees.mjs). Texts and timing come as props (src/rendre.mjs).
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, Audio, Freeze, Img, Sequence, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { F, usePolices } from "./commun.jsx";

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const lisse = (u) => u * u * (3 - 2 * u);
const sortieDouce = (u) => 1 - (1 - u) ** 3;
const VERT = "#3DDC97", MMI = { 3: "#a0e6ff", 4: "#80ffff", 5: "#7cff90", 6: "#ffff00", 7: "#ffc600", 8: "#ff9100", 9: "#ff0000", 10: "#c80000" };
const NOM_MMI = { 4: "Light", 5: "Moderate", 6: "Strong", 7: "Very Strong", 8: "Severe", 9: "Violent", 10: "Extreme" };
const ROMAIN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const nf = new Intl.NumberFormat("en-US");

// Icônes Lucide (ISC), outils/alertes/pictos/
const ICO = {
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  depth: '<path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  drop: '<path d="M15 6v6h4l-7 7-7-7h4V6h6z"/>',
  cover: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  hold: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  satellite: '<path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4 4-4 4-4-4"/><path d="m8 12 4 4 6-6-4-4Z"/><path d="m16 8 3-3"/><path d="M9 21a6 6 0 0 0-6-6"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  monter: '<path d="M13 5H19V11"/><path d="M19 5 5 19"/>',
  attention: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};
const Ico = ({ n, taille, couleur }) => <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICO[n] }} style={{ flex: "none" }} />;

let cache = {};
const useDonnees = (dossier) => {
  const [d, setD] = useState(cache[dossier]);
  const [h] = useState(() => (cache[dossier] ? null : delayRender("donnees " + dossier)));
  useEffect(() => { if (cache[dossier]) return; fetch(staticFile(`${dossier}/donnees.json`)).then((r) => r.json()).then((j) => { cache[dossier] = j; setD(j); continueRender(h); }); }, [dossier, h]);
  return d;
};

// Caméra : centre et zoom selon la scène
const camera = (f, d, S) => {
  const { lon, lat } = d;
  if (f < S.B) {
    const u = lisse(interpolate(f, [0, 100], [0, 1], CL)), z = lisse(interpolate(f, [S.B - 75, S.B], [0, 1], CL));
    return { lon: lon + 75 * (1 - u), lat: lat - 18 * (1 - u), zoom: 1 + 6 * z };
  }
  if (f < S.D) return { lon, lat, zoom: 7 + 0.6 * interpolate(f, [S.B, S.D], [0, 1], CL) };
  if (f < S.E) return { lon, lat, zoom: 7.6 + 6.4 * sortieDouce(interpolate(f, [S.D, S.D + 40], [0, 1], CL)) };
  return { lon, lat, zoom: 14 - 9 * lisse(interpolate(f, [S.E, S.E + 45], [0, 1], CL)) };
};

const projeter = (f, d, S) => { const cam = camera(f, d, S); return geoOrthographic().rotate([-cam.lon, -cam.lat]).translate([540, 1920 * 0.36]).scale(1080 * 0.47 * cam.zoom).clipAngle(90)([d.lon, d.lat]); };

const Carte = ({ d, S, couleur, zone }) => {
  const f = useCurrentFrame(), ref = useRef(null);
  useLayoutEffect(() => {
    const k = ref.current.getContext("2d"), W = 1080, H = 1920, cam = camera(f, d, S), CY = 0.36;
    const R = 1080 * 0.47 * cam.zoom, p = geoOrthographic().rotate([-cam.lon, -cam.lat]).translate([W / 2, H * CY]).scale(R).clipAngle(90), g = geoPath(p, k);
    const vu = (pt) => geoDistance(pt, [cam.lon, cam.lat]) < 1.45;
    k.clearRect(0, 0, W, H);
    const halo = k.createRadialGradient(W / 2, H * CY, R * 0.9, W / 2, H * CY, R * 1.25); halo.addColorStop(0, "rgba(242,169,59,.10)"); halo.addColorStop(1, "rgba(242,169,59,0)");
    k.fillStyle = halo; k.fillRect(0, 0, W, H);
    k.beginPath(); g({ type: "Sphere" }); k.fillStyle = "#132a3d"; k.fill();
    k.beginPath(); g(geoGraticule10()); k.strokeStyle = "rgba(242,169,59,.06)"; k.lineWidth = 1.5; k.stroke();
    k.beginPath(); g(cam.zoom > 3 ? d.geo.detail : d.geo.monde); k.fillStyle = "#2a4c66"; k.fill(); k.strokeStyle = "rgba(170,205,230,.45)"; k.lineWidth = 1.6; k.stroke();
    k.beginPath(); g(d.geo.plaques); k.strokeStyle = "rgba(242,169,59,.28)"; k.lineWidth = 2; k.setLineDash([10, 8]); k.stroke(); k.setLineDash([]);
    k.beginPath(); g({ type: "Sphere" }); k.strokeStyle = "rgba(242,169,59,.25)"; k.lineWidth = 2; k.stroke();
    const c = p([d.lon, d.lat]), occupe = [];
    // Zones de secousse ShakeMap (scène D), du plus faible au plus fort
    if (f >= S.D && f < S.E + 30 && d.shakemap) {
      const niv = [...new Set(d.shakemap.features.map((x) => x.properties.mmi))].sort((a, b) => a - b);
      d.shakemap.features.forEach((x) => {
        const a = interpolate(f, [S.D + 20 + niv.indexOf(x.properties.mmi) * 12, S.D + 32 + niv.indexOf(x.properties.mmi) * 12], [0, 1], CL) * interpolate(f, [S.E, S.E + 25], [1, 0], CL);
        if (a <= 0) return;
        k.globalAlpha = a; k.beginPath(); g(x); k.strokeStyle = MMI[x.properties.mmi] || x.properties.couleur; k.lineWidth = 6; k.shadowColor = k.strokeStyle; k.shadowBlur = 12; k.stroke(); k.shadowBlur = 0;
      });
      k.globalAlpha = 1;
    }
    // Anneaux qui pulsent sur l'épicentre
    if (c && vu([d.lon, d.lat])) {
      for (let r = 0; r < 3; r++) { const a = ((f + r * 20) % 60) / 60; k.globalAlpha = (1 - a) * 0.9; k.strokeStyle = couleur; k.lineWidth = 5; k.shadowColor = couleur; k.shadowBlur = 16; k.beginPath(); k.arc(c[0], c[1], 22 + a * 150, 0, 7); k.stroke(); }
      k.globalAlpha = 1; k.shadowBlur = 0;
      for (const [rr, a, w] of [[90, 0.3, 3], [52, 0.6, 3.5]]) { k.globalAlpha = a; k.beginPath(); k.arc(c[0], c[1], rr, 0, 7); k.strokeStyle = couleur; k.lineWidth = w; k.stroke(); }
      k.globalAlpha = 1; k.shadowColor = couleur; k.shadowBlur = 40; k.beginPath(); k.arc(c[0], c[1], 16, 0, 7); k.fillStyle = "#fff"; k.fill(); k.shadowBlur = 0;
      occupe.push(cam.zoom < 2 ? [c[0] - 60, c[1] - 60, c[0] + 60, c[1] + 60] : [c[0] - 170, c[1] - 170, c[0] + 170, c[1] + 330]);
    }
    // Nom de la zone à côté du point (dessiné par-dessus les zones de secousse) et ville la plus proche, dès que la carte est rapprochée
    if (f >= S.B - 20 && f < S.E && c) {
      const a = interpolate(f, [S.B - 20, S.B], [0, 1], CL);
      k.globalAlpha = a; k.font = `700 44px Bricolage`; k.textAlign = "left"; k.textBaseline = "middle"; k.lineWidth = 9; k.strokeStyle = "rgba(11,20,28,.9)";
      if (zone) { k.strokeText(zone, c[0] + 64, c[1] - 74); k.fillStyle = couleur; k.fillText(zone, c[0] + 64, c[1] - 74); }
      const ville = d.villes[0], q = ville && p([ville.lon, ville.lat]);
      if (q && q[0] > 40 && q[0] < W - 300 && q[1] > 260 && q[1] < H * 0.55) {
        k.beginPath(); k.arc(q[0], q[1], 12, 0, 7); k.fillStyle = "#fff"; k.fill(); k.lineWidth = 4; k.strokeStyle = "#0b141c"; k.stroke();
        k.font = `700 40px Bricolage`; k.lineWidth = 8; k.strokeStyle = "rgba(11,20,28,.9)"; k.strokeText(ville.nom, q[0] + 22, q[1]); k.fillStyle = "#fff"; k.fillText(ville.nom, q[0] + 22, q[1]);
        occupe.push([q[0], q[1] - 26, q[0] + 260, q[1] + 26]);
      }
      k.globalAlpha = 1;
    }
    // Place de la fiche de l'accroche (date et heure), pour que les noms de pays ne passent pas dessous
    if (c && f >= 40 && f < S.B - 60) { const gx = Math.max(60, Math.min(c[0] - 60, W - 520)); occupe.push([gx - 10, c[1] + 30, gx + 470, c[1] + 290]); }
    // Noms des pays visibles
    k.font = `600 38px Plex`; k.textAlign = "center"; k.textBaseline = "middle";
    // Pays les plus proches de l'épicentre d'abord (les grands pays avant les petits), 9 au plus, jamais sur le bord du globe
    const candidats = d.geo.pays.filter(([, x0, y0]) => geoDistance([x0, y0], [cam.lon, cam.lat]) < 1.15)
      .sort((a, b) => (a[3] > 2) - (b[3] > 2) || geoDistance([a[1], a[2]], [d.lon, d.lat]) - geoDistance([b[1], b[2]], [d.lon, d.lat]));
    let poses = 0;
    for (const [n, x0, y0] of candidats) {
      if (poses >= 9) break; const q = p([x0, y0]); if (!q) continue;
      const w = k.measureText(n).width;
      // Si la place est prise, on décale un peu l'étiquette (dessous, dessus, à droite, à gauche) plutôt que de l'abandonner
      const pos = [[0, 0], [0, 50], [0, -50], [w / 2 + 40, 0], [-w / 2 - 40, 0], [0, 90]].map(([dx, dy]) => [q[0] + dx, q[1] + dy])
        .find(([x, y]) => { const b = [x - w / 2 - 12, y - 28, x + w / 2 + 12, y + 28]; return !(b[0] < 30 || b[2] > W - 30 || b[1] < 260 || b[3] > H * 0.58 || occupe.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])); });
      if (!pos) continue;
      const [x, y] = pos;
      occupe.push([x - w / 2 - 12, y - 28, x + w / 2 + 12, y + 28]); poses++; k.lineWidth = 7; k.strokeStyle = "rgba(19,42,61,.85)"; k.strokeText(n, x, y); k.fillStyle = "rgba(232,238,242,.8)"; k.fillText(n, x, y);
    }
  }, [f, d, S, couleur]);
  return <canvas ref={ref} width={1080} height={1920} style={{ position: "absolute", inset: 0, filter: "brightness(1.28) saturate(1.35) contrast(1.06)" }} />;
};

// Habillage de la vidéo promo : coins en cadre photo, logo, coordonnées qui défilent, « Live »
const Hud = ({ d, S, date }) => {
  const f = useCurrentFrame(), cam = camera(f, d, S);
  const coord = `${Math.abs(cam.lat).toFixed(2)}°${cam.lat >= 0 ? "N" : "S"} ${Math.abs(((cam.lon + 540) % 360) - 180).toFixed(2)}°${((cam.lon + 540) % 360) - 180 >= 0 ? "E" : "W"}`;
  const coin = (st) => <div style={{ position: "absolute", width: 56, height: 56, border: "4px solid rgba(232,238,242,.65)", ...st }} />;
  return (
    <>
      {coin({ left: 34, top: 34, borderRight: 0, borderBottom: 0 })}{coin({ right: 34, top: 34, borderLeft: 0, borderBottom: 0 })}
      {coin({ left: 34, bottom: 34, borderRight: 0, borderTop: 0 })}{coin({ right: 34, bottom: 34, borderLeft: 0, borderTop: 0 })}
      <div style={{ position: "absolute", left: 76, top: 70, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, font: `700 40px ${F.titre}`, color: "#fff" }}><Img src={staticFile("pastilles/seismes.svg")} style={{ width: 52, height: 52, borderRadius: "50%" }} />Live Atlas</div>
        <div style={{ font: `500 28px ${F.mono}`, letterSpacing: ".1em", color: "#dfe7ec", fontVariantNumeric: "tabular-nums" }}>{coord}</div>
      </div>
      <div style={{ position: "absolute", right: 76, top: 80, display: "flex", alignItems: "center", gap: 12, font: `500 28px ${F.mono}`, letterSpacing: ".12em", color: "#dfe7ec", textTransform: "uppercase" }}>
        <span style={{ width: 14, height: 14, borderRadius: 7, background: "#FF6A4D", boxShadow: "0 0 14px #FF6A4D", opacity: 0.5 + 0.5 * Math.abs(Math.sin(f / 9)) }} />Live {date}
      </div>
    </>
  );
};

const Voile = ({ fort = 0 }) => <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(11,20,28,.75) 0%, rgba(11,20,28,0) 12%, rgba(11,20,28,${0.05 + fort}) 50%, rgba(11,20,28,.6) 62%, rgba(11,20,28,.82) 74%, #0b141c 92%)` }} />;
const Monte = ({ at, children, style }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), k = spring({ frame: f - at, fps, config: { damping: 200, mass: 0.6 } });
  return <div style={{ opacity: k, transform: `translateY(${(1 - k) * 46}px)`, ...style }}>{children}</div>;
};
const Pastille = ({ at, couleur, children, ico }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), k = spring({ frame: f - at, fps, config: { damping: 12, mass: 0.6 } });
  return <div style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 14, background: couleur, color: "#0b141c", font: `800 42px ${F.titre}`, letterSpacing: ".03em", padding: "10px 30px", borderRadius: 50, transform: `scale(${k})`, transformOrigin: "left center", marginBottom: 18 }}>
    {ico ? <Ico n={ico} taille={40} couleur="#0b141c" /> : <span style={{ width: 16, height: 16, borderRadius: 8, background: "#0b141c" }} />}{children}</div>;
};
const Compte = ({ at, de = 0, a, dur = 30, format = (v) => nf.format(Math.round(v)) }) => {
  const f = useCurrentFrame(); return <>{format(interpolate(f, [at, at + dur], [de, a], { ...CL, easing: sortieDouce }))}</>;
};
const Tape = ({ at, texte, vitesse = 1.6 }) => {
  const f = useCurrentFrame(), n = Math.floor(interpolate(f, [at, at + texte.length / vitesse], [0, texte.length], CL));
  return <>{texte.slice(0, n)}<span style={{ opacity: n < texte.length && f >= at ? 1 : 0 }}>▍</span></>;
};
const Fait = ({ at, ico, couleur, valeur, libelle }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), k = spring({ frame: f - at, fps, config: { damping: 14, mass: 0.5 } });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 22, rowGap: 6, alignItems: "center", opacity: Math.min(1, k * 1.5), transform: `translateX(${(1 - k) * -60}px)` }}>
      <div style={{ transform: `scale(${k})` }}><Ico n={ico} taille={72} couleur={couleur} /></div>
      <div style={{ font: `800 96px/1 ${F.titre}`, color: "#fff", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{valeur}</div>
      <div />
      <div style={{ font: `600 40px ${F.texte}`, color: "#c9d6df", whiteSpace: "nowrap" }}>{libelle}</div>
    </div>
  );
};

// Scène A · accroche
const Accroche = ({ t, S, d }) => {
  const f = useCurrentFrame(), sortie = interpolate(f, [S.B - 14, S.B], [1, 0], CL), pt = projeter(f, d, S);
  const of = interpolate(f, [44, 54], [0, 1], CL) * interpolate(f, [S.B - 80, S.B - 66], [1, 0], CL);
  const atterrit = 66, flash = interpolate(f, [atterrit, atterrit + 3, atterrit + 14], [0, 0.55, 0], CL);
  const sec = f >= atterrit && f < atterrit + 16 ? Math.sin(f * 2.3) * (16 - (f - atterrit)) * 1.4 : 0;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />
      {pt && of > 0 && (
        <div style={{ opacity: of }}>
          <div style={{ position: "absolute", left: pt[0] - 1.5, top: pt[1] + 40, width: 3, height: 110, background: t.couleur }} />
          <div style={{ position: "absolute", left: Math.max(60, Math.min(pt[0] - 60, 1080 - 520)), top: pt[1] + 150, background: "rgba(11,20,28,.88)", border: `3px solid ${t.couleur}`, padding: "16px 26px 18px", display: "flex", flexDirection: "column", gap: 6, whiteSpace: "nowrap" }}>
            <div style={{ font: `800 54px/1 ${F.titre}`, color: t.couleur }}><Tape at={48} texte={t.dateLongue} /></div>
            <div style={{ font: `500 30px ${F.mono}`, letterSpacing: ".1em", textTransform: "uppercase", color: "#e3eaef" }}><Tape at={56} texte={`${t.heure} Local Time`} /></div>
          </div>
        </div>
      )}
      {/* Instagram shows reels cropped to 3:4 in the profile grid (240 px cut at the top and bottom): pill, magnitude and place stay above y = 1600 */}
      <div style={{ position: "absolute", left: 72, right: 72, top: 1050, display: "flex", flexDirection: "column", opacity: sortie, transform: `translate(${sec}px, ${sec * 0.4}px)` }}>
        <Pastille at={10} couleur={t.couleur}>{t.classe} Earthquake</Pastille>
        <div style={{ font: `800 340px/.86 ${F.titre}`, letterSpacing: "-.04em", color: t.couleur, textShadow: `0 0 70px ${t.couleur}88`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: "0.42em", marginRight: 8 }}>M</span><Compte at={20} a={t.mag} dur={atterrit - 20} format={(v) => v.toFixed(1)} />
        </div>
        <Monte at={atterrit + 4} style={{ font: `800 84px/1.05 ${F.titre}`, color: "#fff", marginTop: 18 }}>{t.region}</Monte>
      </div>
    </>
  );
};

// Scène B · l'essentiel : fiche reliée au point, trois faits
const Essentiel = ({ t, S }) => {
  const f = useCurrentFrame(), o = interpolate(f, [S.B - 4, S.B + 8, S.C - 8, S.C], [0, 1, 1, 0], CL), y = 1920 * 0.36;
  return (
    <div style={{ opacity: o }}>
      <div style={{ position: "absolute", left: 539, top: y + 40, width: 3, height: interpolate(f, [S.B, S.B + 12], [0, 120], CL), background: t.couleur }} />
      <div style={{ position: "absolute", left: 480, top: y + 160, background: "rgba(11,20,28,.88)", border: `3px solid ${t.couleur}`, padding: "18px 28px 20px", display: "flex", flexDirection: "column", gap: 8, opacity: interpolate(f, [S.B + 10, S.B + 16], [0, 1], CL), whiteSpace: "nowrap" }}>
        <div style={{ font: `800 62px/1 ${F.titre}`, color: t.couleur }}><Tape at={S.B + 14} texte={`M ${t.mag.toFixed(1)}`} /></div>
        <div style={{ font: `500 30px ${F.mono}`, letterSpacing: ".1em", textTransform: "uppercase", color: "#e3eaef" }}><Tape at={S.B + 20} texte={t.lieuFiche} /></div>
        <div style={{ font: `500 30px ${F.mono}`, letterSpacing: ".1em", textTransform: "uppercase", color: "#e3eaef" }}><Tape at={S.B + 32} texte={t.coords} /></div>
      </div>
      <div style={{ position: "absolute", left: 72, right: 72, top: 1150, display: "flex", flexDirection: "column", gap: 62 }}>
        <Fait at={S.B + 30} ico="clock" couleur={t.couleur} valeur={t.heure} libelle={`Local Time, ${t.date}`} />
        <Fait at={S.B + 52} ico="depth" couleur={t.couleur} valeur={<><Compte at={S.B + 52} a={t.profMi} dur={24} /> mi</>} libelle={`Depth (${t.profKm} km)`} />
        <Fait at={S.B + 74} ico="users" couleur={t.couleur} valeur={<Compte at={S.B + 74} a={t.exposes} dur={34} />} libelle="People Felt Strong Shaking" />
      </div>
    </div>
  );
};

// Scène C · vue satellite du lendemain
const Satellite = ({ t, S, dossier }) => {
  const f = useCurrentFrame(), o = interpolate(f, [S.C - 6, S.C + 10, S.D - 8, S.D + 4], [0, 1, 1, 0], CL), z = interpolate(f, [S.C, S.D], [1.06, 1.2], CL);
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <Img src={staticFile(`${dossier}/${t.satFichier}`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})`, filter: "brightness(1.08) contrast(1.14) saturate(1.3)" }} />
      <div style={{ position: "absolute", left: 540 - 20, top: 960 - 20, width: 40, height: 40, borderRadius: 20, background: t.couleur, boxShadow: `0 0 0 ${14 + 8 * Math.sin(f / 6)}px ${t.couleur}55, 0 0 0 ${40 + 10 * Math.sin(f / 6)}px ${t.couleur}22` }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,20,28,.75) 0%, rgba(11,20,28,0) 14%, rgba(11,20,28,0) 58%, rgba(11,20,28,.7) 76%, rgba(11,20,28,.92) 100%)" }} />
      <div style={{ position: "absolute", left: 72, right: 72, top: 1400, display: "flex", flexDirection: "column" }}>
        <Pastille at={S.C + 6} couleur="#e3eaef" ico="satellite">From Space</Pastille>
        <Monte at={S.C + 12} style={{ font: `800 120px/1 ${F.titre}`, color: "#fff" }}>{t.satTitre[0]}<span style={{ color: t.couleur }}>{t.satTitre[1]}</span></Monte>
        <Monte at={S.C + 20} style={{ font: `700 50px ${F.titre}`, color: "#dfe7ec", marginTop: 14 }}>{t.satLigne}</Monte>
      </div>
    </div>
  );
};

// Scène D · où ça a le plus secoué
const Secousses = ({ t, S }) => {
  const f = useCurrentFrame(), o = interpolate(f, [S.D, S.D + 10, S.E - 8, S.E], [0, 1, 1, 0], CL);
  const ligne = (i, gauche, droite, niv) => {
    const at = S.D + 30 + i * 14;
    return (
      <Monte key={i} at={at} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 20, borderTop: "2px solid rgba(255,255,255,.12)", padding: "20px 0" }}>
        <div style={{ font: `700 54px ${F.titre}`, color: "#fff", whiteSpace: "nowrap" }}>{gauche}</div>
        <div style={{ font: `800 38px ${F.titre}`, color: "#0b141c", background: MMI[niv], padding: "8px 22px", borderRadius: 40, whiteSpace: "nowrap" }}>{droite}</div>
      </Monte>
    );
  };
  return (
    <div style={{ position: "absolute", left: 72, right: 72, top: 1180, opacity: o }}>
      <Monte at={S.D + 10} style={{ font: `800 88px/1 ${F.titre}`, color: "#fff", marginBottom: 26, whiteSpace: "nowrap" }}>Where It <span style={{ color: t.couleur }}>Shook</span> Most</Monte>
      {t.lignes.map(([g, dr, niv], i) => ligne(i, g, dr, niv))}
    </div>
  );
};

// Scène E · que faire
const QueFaire = ({ t, S }) => {
  const f = useCurrentFrame(), o = interpolate(f, [S.E, S.E + 10, S.F - 8, S.F], [0, 1, 1, 0], CL);
  const geste = (i, ico, titre, texte) => (
    <Monte key={i} at={S.E + 24 + i * 18} style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 24, alignItems: "center" }}>
      <Ico n={ico} taille={84} couleur={VERT} />
      <div><div style={{ font: `800 84px/1 ${F.titre}`, color: "#fff" }}>{titre}</div><div style={{ font: `600 38px ${F.texte}`, color: "#c9d6df", marginTop: 6 }}>{texte}</div></div>
    </Monte>
  );
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "rgba(11,20,28,.45)", opacity: o }} />
      <div style={{ position: "absolute", left: 72, right: 72, top: 1010, opacity: o, display: "flex", flexDirection: "column" }}>
        <Pastille at={S.E + 4} couleur={VERT}>{t.conseil === "cote" ? "Near the Coast" : "If You Feel an Aftershock"}</Pastille>
        <Monte at={S.E + 10} style={{ font: `800 130px/1 ${F.titre}`, color: "#fff", marginBottom: 46 }}>What <span style={{ color: VERT }}>To Do</span></Monte>
        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          {t.conseil === "cote"
            ? <>{geste(0, "activity", "Strong Shaking", "Strong or long shaking is a warning")}{geste(1, "monter", "Go Higher", "Move to high ground or inland")}{geste(2, "attention", "Right Away", "Don't wait for an official alert")}</>
            : <>{geste(0, "drop", "Drop", "Get down on your hands and knees")}{geste(1, "cover", "Cover", "Protect your head and neck")}{geste(2, "hold", "Hold On", "Until the shaking stops")}</>}
        </div>
      </div>
    </>
  );
};

// Scène F · fin
const Fin = ({ t, S }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  if (f < S.F - 10) return null;
  const o = interpolate(f, [S.F - 10, S.F + 6], [0, 1], CL), k = spring({ frame: f - S.F, fps, config: { damping: 9, mass: 0.7 } });
  const mot = (i, txt, couleur) => { const m = spring({ frame: f - S.F - 14 - i * 5, fps, config: { damping: 200 } }); return <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", marginRight: 22 }}><span style={{ display: "inline-block", transform: `translateY(${(1 - m) * 110}%)`, color: couleur }}>{txt}</span></span>; };
  const h = spring({ frame: f - S.F - 40, fps, config: { damping: 14 } });
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o, background: "radial-gradient(circle at 50% 40%, #16293a, #0b141c 70%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 50 }}>
      <div style={{ position: "relative", width: 380, height: 380, display: "grid", placeItems: "center" }}>
        {[0, 1, 2].map((r) => { const a = ((f - S.F + r * 22) % 66) / 66; return f > S.F ? <div key={r} style={{ position: "absolute", width: 380 + a * 420, height: 380 + a * 420, borderRadius: "50%", border: "5px solid #FF6A4D", opacity: (1 - a) * 0.6 }} /> : null; })}
        <Img src={staticFile("pastilles/seismes.svg")} style={{ width: 380, height: 380, borderRadius: "50%", transform: `scale(${k})` }} />
      </div>
      <div style={{ font: `800 120px/1.02 ${F.titre}`, color: "#fff", textAlign: "center" }}>
        <div>{mot(0, "Every")}{mot(1, "Quake")}</div><div>{mot(2, "That", "#FF6A4D")}{mot(3, "Matters", "#FF6A4D")}</div>
      </div>
      <div style={{ font: `500 46px ${F.mono}`, letterSpacing: ".06em", color: "#c9d6df", padding: "14px 34px", border: "3px solid rgba(201,214,223,.35)", borderRadius: 50, opacity: h, transform: `translateY(${(1 - h) * 30}px)` }}>@LiveAtlasQuakes</div>
    </div>
  );
};

// Picture of the reel. The first 2 frames show the cover state (frame 90): players that take the first frame as thumbnail
// (X among others) then show the magnitude, date and time instead of a counter at "M0.0".
const Visuels = ({ d, t, S, dossier }) => {
  const f = useCurrentFrame();
  return (
    <>
      <Carte d={d} S={S} couleur={t.couleur} zone={t.zone} />
      <Voile fort={f >= S.E && f < S.F ? 0.2 : 0} />
      <Accroche t={t} S={S} d={d} />
      <Essentiel t={t} S={S} />
      <Satellite t={t} S={S} dossier={dossier} />
      <Secousses t={t} S={S} />
      <QueFaire t={t} S={S} />
      {f < S.F && <Hud d={d} S={S} date={t.date} />}
      <Fin t={t} S={S} />
    </>
  );
};

export const AlerteSeisme = ({ dossier, t, S, audio }) => {
  const pret = usePolices(), d = useDonnees(dossier), f = useCurrentFrame();
  if (!d || !pret) return <AbsoluteFill style={{ background: "#0b141c" }} />;
  const parle = (fr) => audio.parle.some(([a, b]) => fr >= a - 6 && fr <= b + 6);
  return (
    <AbsoluteFill style={{ background: "#0b141c", overflow: "hidden" }}>
      {f < 2 ? <Freeze frame={90}><Visuels d={d} t={t} S={S} dossier={dossier} /></Freeze> : <Visuels d={d} t={t} S={S} dossier={dossier} />}
      {/* Son : voix devant, musique 0,14 sous la voix et 0,45 hors voix, bruitages brefs entre les phrases (REGLAGES-SON-ET-COUVERTURES.md) */}
      <Sequence from={audio.voixDebut}><Audio src={staticFile(`${dossier}/voix.mp3`)} /></Sequence>
      <Audio src={staticFile(audio.musique)} volume={(fr) => (parle(fr) ? 0.14 : 0.45) * interpolate(fr, [audio.fin - 45, audio.fin], [1, 0], CL)} />
      <Sequence from={0} durationInFrames={95}><Audio src={staticFile("sons/grondement.mp3")} volume={(fr) => interpolate(fr, [0, 14, 30, 95], [0.6, 0.35, 0.12, 0], CL)} /></Sequence>
      <Sequence from={66} durationInFrames={40}><Audio src={staticFile("sons/impact.wav")} volume={0.32} /></Sequence>
      {[S.B - 70, S.C - 4, S.D - 4].map((x, i) => <Sequence key={i} from={x} durationInFrames={40}><Audio src={staticFile("sons/whoosh.wav")} volume={0.18} /></Sequence>)}
      <Sequence from={S.B + 14} durationInFrames={60}><Audio src={staticFile("sons/clavier.mp3")} volume={0.2} /></Sequence>
      {[S.B + 30, S.B + 52, S.B + 74].map((x, i) => <Sequence key={"t" + i} from={x} durationInFrames={20}><Audio src={staticFile("sons/tick.wav")} volume={0.25} /></Sequence>)}
    </AbsoluteFill>
  );
};
