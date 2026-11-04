// Regular posts of the alert accounts (src/rubriques.mjs), 1080 × 1350: account header, pill, title, world map with the points,
// then numbered rows that match the numbers on the map. Used by "Erupting Now", "Alert Levels", "Volcanoes This Week"
// (@LiveAtlasErupts) and "Earthquakes of the Day" (@LiveAtlasQuakes).
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { geoEqualEarth, geoPath } from "d3-geo";
import { F, mesure, usePolices } from "./commun.jsx";
import { useDonnees } from "./PostSeisme.jsx";

const W = 1080, CARTE_H = 500;
// Title on one line: the largest size from 76 px down that fits the 968 px of text width
const tailleTitre = (s) => { let t = 76; while (t > 44 && mesure(s, `800 ${t}px Bricolage`, -0.02 * t) > 968) t -= 2; return t; };

// World map (Equal Earth), countries and faint plate boundaries; volcanoes as triangles, earthquakes as discs sized by magnitude.
// The listed points carry their row number.
const Monde = ({ d, points, volcan }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const k = ref.current.getContext("2d"), p = geoEqualEarth().fitExtent([[24, 10], [W - 24, CARTE_H - 10]], { type: "Sphere" }), g = geoPath(p, k);
    k.clearRect(0, 0, W, CARTE_H);
    k.beginPath(); g({ type: "Sphere" }); k.fillStyle = "#132a3d"; k.fill();
    k.beginPath(); g(d.geo.monde); k.fillStyle = "#2a4c66"; k.fill(); k.strokeStyle = "rgba(170,205,230,.4)"; k.lineWidth = 1; k.stroke();
    k.beginPath(); g(d.geo.plaques); k.strokeStyle = "rgba(242,169,59,.3)"; k.lineWidth = 1.5; k.setLineDash([6, 5]); k.stroke(); k.setLineDash([]);
    // Unnumbered points first, the numbered ones on top
    for (const pt of [...points].sort((a, b) => (a.n ?? 0) - (b.n ?? 0) || (a.taille ?? 0) - (b.taille ?? 0))) {
      const c = p([pt.lon, pt.lat]); if (!c) continue;
      k.fillStyle = pt.couleur; k.strokeStyle = "#0b141c"; k.lineWidth = 2;
      if (volcan) { const z = pt.n ? 13 : 9; k.beginPath(); k.moveTo(c[0], c[1] - z); k.lineTo(c[0] + z, c[1] + z * 0.8); k.lineTo(c[0] - z, c[1] + z * 0.8); k.closePath(); k.fill(); k.stroke(); }
      else { k.beginPath(); k.arc(c[0], c[1], pt.taille ?? 6, 0, 7); k.globalAlpha = 0.85; k.fill(); k.globalAlpha = 1; k.stroke(); }
      if (pt.n) {
        k.font = "800 26px Bricolage"; k.textAlign = "center"; k.textBaseline = "middle";
        const x = c[0] + 22, y = c[1] - 20;
        k.beginPath(); k.arc(x, y, 17, 0, 7); k.fillStyle = "#fff"; k.fill(); k.lineWidth = 3; k.strokeStyle = pt.couleur; k.stroke();
        k.fillStyle = "#0b141c"; k.fillText(String(pt.n), x, y + 1);
      }
    }
  }, [d, points, volcan]);
  return <canvas ref={ref} width={W} height={CARTE_H} style={{ display: "block", filter: "brightness(1.18) saturate(1.25)" }} />;
};

export const Rubrique = ({ dossier, t }) => {
  const pret = usePolices(), d = useDonnees(dossier);
  if (!d || !pret) return <AbsoluteFill style={{ background: "#0b141c" }} />;
  const volcan = t.compte === "volcans";
  return (
    <AbsoluteFill style={{ background: "#0b141c", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 56, right: 56, top: 46, display: "flex", alignItems: "center", gap: 18 }}>
        <Img src={staticFile(`pastilles/${t.compte}.svg`)} style={{ width: 76, height: 76, borderRadius: "50%" }} />
        <span style={{ font: `600 32px ${F.titre}`, color: "#fff", flex: 1 }}>Live Atlas <span style={{ color: t.couleur }}>{volcan ? "Volcano" : "Earthquake"}</span></span>
        <span style={{ font: `500 24px ${F.mono}`, letterSpacing: ".1em", color: "#b9c7d0", textTransform: "uppercase" }}>{t.date}</span>
      </div>
      <div style={{ position: "absolute", left: 56, right: 56, top: 158, display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 12, background: t.couleur, color: "#0b141c", font: `800 30px ${F.titre}`, letterSpacing: ".04em", padding: "7px 22px", borderRadius: 40 }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: "#0b141c" }} />{t.pastille}</span>
        <div style={{ font: `800 ${tailleTitre(t.titre)}px/1.05 ${F.titre}`, letterSpacing: "-.02em", color: "#fff", whiteSpace: "nowrap" }}>{t.titre}</div>
        {t.sousTitre && <div style={{ font: `600 30px/1.25 ${F.texte}`, color: "#c9d6df" }}>{t.sousTitre}</div>}
        <div style={{ margin: "4px -56px 6px" }}><Monde d={d} points={t.points} volcan={volcan} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {t.lignes.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, height: 58, borderBottom: i < t.lignes.length - 1 ? "1px solid rgba(255,255,255,.08)" : "none" }}>
              <span style={{ width: 40, height: 40, borderRadius: 20, background: "#fff", border: `3px solid ${l.couleur}`, color: "#0b141c", font: `800 24px/34px ${F.titre}`, textAlign: "center", flex: "none" }}>{i + 1}</span>
              <span style={{ font: `800 36px ${F.titre}`, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 480 }}>{l.nom}</span>
              <span style={{ font: `600 26px ${F.texte}`, color: "#9fb2c0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{l.lieu}</span>
              <span style={{ font: `500 24px ${F.mono}`, letterSpacing: ".06em", color: l.couleur, textTransform: "uppercase", whiteSpace: "nowrap" }}>{l.valeur}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", right: 48, bottom: 34, font: `500 18px ${F.mono}`, letterSpacing: ".08em", color: "rgba(255,255,255,.7)" }}>liveatlas.earth</div>
    </AbsoluteFill>
  );
};
