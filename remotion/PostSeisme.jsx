// Still images of an earthquake alert, after the validated Live Atlas templates:
// "carre" 1080 × 1350 (Instagram, Facebook), "x" 1600 × 900, "secousses" 1080 × 1350 (second carousel image, ShakeMap + PAGER).
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Img, staticFile } from "remotion";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { F, mesure, usePolices } from "./commun.jsx";

const MMI = { 3: "#a0e6ff", 4: "#80ffff", 5: "#7cff90", 6: "#ffff00", 7: "#ffc600", 8: "#ff9100", 9: "#ff0000", 10: "#c80000" };
const ROMAIN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"], NOM = { 2: "Weak", 3: "Weak", 4: "Light", 5: "Moderate", 6: "Strong", 7: "Very Strong", 8: "Severe", 9: "Violent", 10: "Extreme" };
const CLASSES = [["Light", "#F2D14B"], ["Moderate", "#F2A93B"], ["Strong", "#FF6A4D"], ["Major", "#E5303A"], ["Great", "#B0124A"]];
const ICO = {
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  depth: '<path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
};
export const Ico = ({ n, taille, couleur }) => <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICO[n] }} style={{ flex: "none" }} />;

const cache = {};
export const useDonnees = (dossier) => {
  const [d, setD] = useState(cache[dossier]);
  const [h] = useState(() => (cache[dossier] ? null : delayRender("donnees")));
  useEffect(() => { if (cache[dossier]) return; fetch(staticFile(`${dossier}/donnees.json`)).then((r) => r.json()).then((j) => { cache[dossier] = j; setD(j); continueRender(h); }); }, [dossier, h]);
  return d;
};

// Map: orthographic close-up, countries, faint plate boundaries, rings or ShakeMap contours, country names that never overlap
export const Carte = ({ d, W, H, cx, cy, zoom, couleur, mode, reserve = [] }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const k = ref.current.getContext("2d"), u = W / (W === 1600 ? 1600 : 1080);
    const R = Math.min(W, H) * 0.47 * zoom, p = geoOrthographic().rotate([-d.lon, -d.lat]).translate([W * cx, H * cy]).scale(R).clipAngle(90), g = geoPath(p, k);
    k.clearRect(0, 0, W, H);
    k.beginPath(); g({ type: "Sphere" }); k.fillStyle = "#132a3d"; k.fill();
    k.beginPath(); g(geoGraticule10()); k.strokeStyle = "rgba(242,169,59,.06)"; k.lineWidth = 1.5; k.stroke();
    k.beginPath(); g(zoom > 3 ? d.geo.detail : d.geo.monde); k.fillStyle = "#2a4c66"; k.fill(); k.strokeStyle = "rgba(170,205,230,.45)"; k.lineWidth = 1.6; k.stroke();
    k.beginPath(); g(d.geo.plaques); k.strokeStyle = "rgba(242,169,59,.28)"; k.lineWidth = 2; k.setLineDash([10, 8]); k.stroke(); k.setLineDash([]);
    const c = p([d.lon, d.lat]), occupe = [...reserve];
    if (mode === "secousses" && d.shakemap) {
      for (const f of [...d.shakemap.features].sort((a, b) => a.properties.mmi - b.properties.mmi)) { k.beginPath(); g(f); k.strokeStyle = MMI[f.properties.mmi] ?? "#fff"; k.lineWidth = 6; k.shadowColor = k.strokeStyle; k.shadowBlur = 10; k.stroke(); }
      k.shadowBlur = 0;
      for (const v of d.villes.slice(0, 3)) {
        const q = p([v.lon, v.lat]); if (!q || q[1] > H * 0.55) continue;
        k.beginPath(); k.arc(q[0], q[1], 10, 0, 7); k.fillStyle = "#fff"; k.fill(); k.lineWidth = 3; k.strokeStyle = "#0b141c"; k.stroke();
        k.font = "700 32px Bricolage"; k.textAlign = "left"; k.textBaseline = "middle"; k.lineWidth = 7; k.strokeStyle = "rgba(11,20,28,.9)"; k.strokeText(v.nom, q[0] + 18, q[1]); k.fillStyle = "#fff"; k.fillText(v.nom, q[0] + 18, q[1]);
        occupe.push([q[0], q[1] - 22, q[0] + 300, q[1] + 22]);
      }
      if (c) { k.save(); k.translate(c[0], c[1]); k.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 26; k.lineTo(Math.cos(a) * r, Math.sin(a) * r); } k.closePath(); k.fillStyle = couleur; k.fill(); k.lineWidth = 3; k.strokeStyle = "#fff"; k.stroke(); k.restore(); }
    } else if (c) {
      for (const [r, a, w] of [[150, 0.14, 2.5], [100, 0.28, 3], [62, 0.55, 3.5], [32, 0.9, 4]]) { k.globalAlpha = a; k.beginPath(); k.arc(c[0], c[1], r, 0, 7); k.strokeStyle = couleur; k.lineWidth = w; k.stroke(); }
      k.globalAlpha = 1; k.shadowColor = couleur; k.shadowBlur = 40;
      if (mode === "volcan") { const z = 28; k.beginPath(); k.moveTo(c[0], c[1] - z); k.lineTo(c[0] + z, c[1] + z * 0.75); k.lineTo(c[0] - z, c[1] + z * 0.75); k.closePath(); k.fillStyle = "#F2A93B"; k.fill(); k.lineWidth = 3; k.strokeStyle = "#fff"; k.stroke(); }
      else { k.beginPath(); k.arc(c[0], c[1], 14, 0, 7); k.fillStyle = "#fff"; k.fill(); }
      k.shadowBlur = 0;
      occupe.push([c[0] - 170, c[1] - 170, c[0] + 170, c[1] + 170]);
    }
    const fs = 32, limite = W === 1600 ? H : H * 0.5;
    k.font = `600 ${fs}px Plex`; k.textAlign = "center"; k.textBaseline = "middle";
    const candidats = d.geo.pays.filter(([, x, y]) => geoDistance([x, y], [d.lon, d.lat]) < 1.15).sort((a, b) => (a[3] > 2) - (b[3] > 2) || geoDistance([a[1], a[2]], [d.lon, d.lat]) - geoDistance([b[1], b[2]], [d.lon, d.lat]));
    let n = 0;
    for (const [nom, x0, y0] of candidats) {
      if (n >= 7) break; const q = p([x0, y0]); if (!q) continue; const w = k.measureText(nom).width;
      const pos = [[0, 0], [0, 44], [0, -44], [w / 2 + 36, 0], [-w / 2 - 36, 0]].map(([dx, dy]) => [q[0] + dx, q[1] + dy]).find(([x, y]) => {
        const b = [x - w / 2 - 10, y - 24, x + w / 2 + 10, y + 24];
        return !(b[0] < 20 || b[2] > W - 20 || b[1] < 140 || b[3] > limite || occupe.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]));
      });
      if (!pos) continue; const [x, y] = pos; occupe.push([x - w / 2 - 10, y - 24, x + w / 2 + 10, y + 24]); n++;
      k.lineWidth = 6; k.strokeStyle = "rgba(19,42,61,.85)"; k.strokeText(nom, x, y); k.fillStyle = "rgba(232,238,242,.8)"; k.fillText(nom, x, y);
    }
  }, [d, W, H, cx, cy, zoom, couleur, mode]);
  return <canvas ref={ref} width={W} height={H} style={{ position: "absolute", inset: 0, filter: "brightness(1.22) saturate(1.3) contrast(1.05)" }} />;
};

export const projeter = (d, W, H, cx, cy, zoom) => geoOrthographic().rotate([-d.lon, -d.lat]).translate([W * cx, H * cy]).scale(Math.min(W, H) * 0.47 * zoom).clipAngle(90)([d.lon, d.lat]);
// Font size that keeps a line on one line
const taillePour = (texte, poids, max, largeur) => { const k = document.createElement("canvas").getContext("2d"); let s = max; do { k.font = `${poids} ${s}px Bricolage`; if (k.measureText(texte).width <= largeur) return s; s -= 1; } while (s > 20); return s; };

const Haut = ({ t, largeur }) => (
  <div style={{ position: "absolute", left: 56, top: 46, width: largeur, display: "flex", alignItems: "center", gap: 18 }}>
    <Img src={staticFile("pastilles/seismes.svg")} style={{ width: 76, height: 76, borderRadius: "50%" }} />
    <span style={{ font: `600 32px ${F.titre}`, color: "#fff", flex: 1 }}>Live Atlas <span style={{ color: t.couleur }}>Earthquake</span></span>
    <span style={{ font: `500 24px ${F.mono}`, letterSpacing: ".1em", color: "#b9c7d0", textTransform: "uppercase" }}>{t.dateLongue}</span>
  </div>
);
// Place card under the epicenter: width measured from its text, shifted left (or the name shrunk) so it never leaves the image
// (titre: name in color, lignes: monospace lines in capitals; 52 px = padding and border; min: left limit, 940 on the X format
// where the text block takes the left half)
export const boiteFiche = (titre, lignes, x, W, min = 40) => {
  const taille = taillePour(titre, 800, 46, W - 40 - min - 52);
  const l = Math.ceil(Math.max(mesure(titre, `800 ${taille}px Bricolage`), ...lignes.map((s) => mesure(s.toUpperCase(), "500 21px Mono", 21 * 0.12)))) + 52;
  return { g: Math.max(min, Math.min(x - 50, W - 40 - l)), l, taille };
};
export const reserveFiche = (titre, lignes, pt, W, min) => { if (!pt) return []; const { g, l } = boiteFiche(titre, lignes, pt[0], W, min); return [[g - 20, pt[1] + 120, g + l + 20, pt[1] + 300]]; };
const lignesFiche = (t) => [t.coords, `${t.date} ${t.heure} ${t.libelleHeure === "UTC" ? "UTC" : "Local"}`];
const Fiche = ({ t, x, y, W, min }) => {
  const { g, taille } = boiteFiche(t.lieuFiche, lignesFiche(t), x, W, min);
  return (
    <>
      <div style={{ position: "absolute", left: x - 1, top: y + 34, width: 2, height: 116, background: t.couleur }} />
      <div style={{ position: "absolute", left: g, top: y + 150, background: "rgba(11,20,28,.86)", border: `2px solid ${t.couleur}`, padding: "16px 24px 18px", display: "flex", flexDirection: "column", gap: 6, whiteSpace: "nowrap" }}>
        <b style={{ font: `800 ${taille}px/1 ${F.titre}`, color: t.couleur }}>{t.lieuFiche}</b>
        {lignesFiche(t).map((s) => <span key={s} style={{ font: `500 21px ${F.mono}`, letterSpacing: ".12em", textTransform: "uppercase", color: "#e3eaef" }}>{s}</span>)}
      </div>
    </>
  );
};
// e: scale of the facts row, below 1 only when the row would not fit (long label such as "Depth, Not Yet Measured")
const largeurFait = ([, valeur, libelle]) => 46 + 14 + Math.max(mesure(valeur, "800 62px Bricolage"), mesure(libelle, "600 30px Plex"));
const Fait = ({ ico, couleur, valeur, libelle, e = 1 }) => (
  <div style={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: 14 * e, rowGap: 4, alignItems: "center", justifyContent: "start" }}>
    <Ico n={ico} taille={46 * e} couleur={couleur} /><b style={{ font: `800 ${62 * e}px/1 ${F.titre}`, color: "#fff", whiteSpace: "nowrap" }}>{valeur}</b>
    <span /><span style={{ font: `600 ${30 * e}px ${F.texte}`, color: "#c9d6df", whiteSpace: "nowrap" }}>{libelle}</span>
  </div>
);
const Bloc = ({ t, largeur, style }) => {
  // Third fact only when there is data: USGS impact level, else felt reports (never a "0")
  const i = CLASSES.findIndex(([n]) => n === t.classe), dernier = t.pager ? ["gauge", t.pager[0].toUpperCase() + t.pager.slice(1), "Impact Level"] : t.ressenti ? ["users", String(t.ressenti), "Felt Reports"] : null;
  const faits = [["clock", t.heure, t.libelleHeure ?? "Local Time"], ["depth", t.profFixee ? "Shallow" : `${t.profMi} mi`, t.profLibelle ?? `Depth (${t.profKm} km)`], ...(dernier ? [dernier] : [])];
  const e = Math.min(1, largeur / (faits.reduce((a, x) => a + largeurFait(x), 0) + 36 * (faits.length - 1)));
  return (
    <div style={{ position: "absolute", display: "flex", flexDirection: "column", gap: 16, width: largeur, ...style }}>
      <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 12, background: t.couleur, color: "#0b141c", font: `800 34px ${F.titre}`, letterSpacing: ".04em", padding: "8px 24px", borderRadius: 40, marginBottom: 12 }}>
        <span style={{ width: 14, height: 14, borderRadius: 7, background: "#0b141c" }} />{t.classe}</span>
      <div style={{ font: `800 230px/.86 ${F.titre}`, letterSpacing: "-.04em", color: t.couleur, textShadow: `0 0 60px ${t.couleur}73` }}><span style={{ fontSize: ".42em", marginRight: 6 }}>M</span>{t.mag.toFixed(1)}</div>
      <div style={{ font: `700 ${taillePour(t.lieuLigne, 700, 56, largeur)}px/1.12 ${F.titre}`, color: "#fff", whiteSpace: "nowrap" }}>{t.lieuLigne}</div>
      <div style={{ display: "flex", gap: 36 * e, marginTop: 6 }}>
        {faits.map(([ico, valeur, libelle]) => <Fait key={ico} ico={ico} couleur={t.couleur} valeur={valeur} libelle={libelle} e={e} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginTop: 10 }}>
        {CLASSES.map(([n, c], j) => <i key={n} style={{ height: 10, borderRadius: 5, background: c, opacity: j === i ? 1 : 0.25, boxShadow: j === i ? `0 0 18px ${c}` : "none" }} />)}
      </div>
    </div>
  );
};
const Pied = ({ style }) => <div style={{ position: "absolute", right: 48, bottom: 34, font: `500 18px ${F.mono}`, letterSpacing: ".08em", color: "rgba(255,255,255,.7)", ...style }}>liveatlas.earth</div>;

export const PostSeisme = ({ dossier, t, format }) => {
  const pret = usePolices(), d = useDonnees(dossier);
  if (!d || !pret) return <AbsoluteFill style={{ background: "#0b141c" }} />;
  if (format === "x") {
    const W = 1600, H = 900, cx = 0.71, cy = 0.38, zoom = 3, pt = projeter(d, W, H, cx, cy, zoom);
    return (
      <AbsoluteFill style={{ background: "#0b141c", overflow: "hidden" }}>
        <Carte d={d} W={W} H={H} cx={cx} cy={cy} zoom={zoom} couleur={t.couleur} reserve={[[0, 0, W * 0.5, H], ...reserveFiche(t.lieuFiche, lignesFiche(t), pt, W, 940)]} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,#0b141c 0%,#0b141c 40%,rgba(11,20,28,.55) 47%,rgba(11,20,28,0) 56%)" }} />
        {pt && <Fiche t={t} x={pt[0]} y={pt[1]} W={W} min={940} />}
        <Haut t={t} largeur={860} />
        <Bloc t={t} largeur={860} style={{ left: 56, top: 160 }} />
        <Pied />
      </AbsoluteFill>
    );
  }
  if (format === "secousses") {
    const W = 1080, H = 1350;
    return (
      <AbsoluteFill style={{ background: "#0b141c", overflow: "hidden" }}>
        <Carte d={d} W={W} H={H} cx={0.5} cy={0.3} zoom={t.zoomSecousses} couleur={t.couleur} mode="secousses" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(11,20,28,.8) 0%,rgba(11,20,28,0) 11%,rgba(11,20,28,0) 48%,rgba(11,20,28,.93) 60%,#0b141c 70%)" }} />
        <Haut t={t} largeur={968} />
        <div style={{ position: "absolute", left: 56, right: 56, bottom: 110, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <b style={{ font: `800 120px/.9 ${F.titre}`, color: t.couleur, letterSpacing: "-.03em" }}>{new Intl.NumberFormat("en-US").format(t.exposes)}</b>
            <span style={{ font: `700 40px/1.1 ${F.titre}`, color: "#fff", maxWidth: 520 }}>People Felt Strong Shaking or More</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {d.villes.slice(0, 3).map((v) => { const n = Math.round(v.mmi); return (
              <div key={v.nom} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 22, alignItems: "center", borderTop: "1px solid rgba(255,255,255,.1)", padding: "13px 0" }}>
                <b style={{ font: `700 44px ${F.titre}`, color: "#fff" }}>{v.nom}</b>
                <span style={{ font: `600 31px ${F.texte}`, color: "#c9d6df" }}>{v.mi} mi ({v.km} km) {v.dir}</span>
                <i style={{ font: `800 26px ${F.titre}`, fontStyle: "normal", color: "#0b141c", background: MMI[n] ?? "#fff", padding: "6px 16px", borderRadius: 30, whiteSpace: "nowrap" }}>{ROMAIN[n]} {NOM[n]}</i>
              </div>); })}
          </div>
        </div>
        <Pied />
      </AbsoluteFill>
    );
  }
  const W = 1080, H = 1350, cy = 0.29, zoom = 3.4, pt = projeter(d, W, H, 0.5, cy, zoom);
  return (
    <AbsoluteFill style={{ background: "#0b141c", overflow: "hidden" }}>
      <Carte d={d} W={W} H={H} cx={0.5} cy={cy} zoom={zoom} couleur={t.couleur} reserve={reserveFiche(t.lieuFiche, lignesFiche(t), pt, W)} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(11,20,28,.8) 0%,rgba(11,20,28,0) 11%,rgba(11,20,28,0) 48%,rgba(11,20,28,.93) 60%,#0b141c 70%)" }} />
      {pt && <Fiche t={t} x={pt[0]} y={pt[1]} W={W} />}
      <Haut t={t} largeur={968} />
      <Bloc t={t} largeur={968} style={{ left: 56, bottom: 110 }} />
      <Pied />
    </AbsoluteFill>
  );
};
