// Still images of a volcano alert for @LiveAtlasErupts, after the validated templates: "carre" 1080 × 1350, "x" 1600 × 900.
// Pill (New Eruption / Alert Level 3), volcano name, country in color then "Erupting Since …", alert facts with icons.
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { F, usePolices } from "./commun.jsx";
import { Carte, Ico, projeter, useDonnees } from "./PostSeisme.jsx";

const Haut = ({ t, largeur }) => (
  <div style={{ position: "absolute", left: 56, top: 46, width: largeur, display: "flex", alignItems: "center", gap: 18 }}>
    <Img src={staticFile("pastilles/volcans.svg")} style={{ width: 76, height: 76, borderRadius: "50%" }} />
    <span style={{ font: `600 32px ${F.titre}`, color: "#fff", flex: 1 }}>Live Atlas <span style={{ color: t.couleur }}>Volcano</span></span>
    <span style={{ font: `500 24px ${F.mono}`, letterSpacing: ".1em", color: "#b9c7d0", textTransform: "uppercase" }}>{t.date}</span>
  </div>
);
const Fiche = ({ t, x, y, W }) => {
  const g = Math.max(40, Math.min(x - 50, W - 520));
  return (
    <>
      <div style={{ position: "absolute", left: x - 1, top: y + 34, width: 2, height: 116, background: t.couleur }} />
      <div style={{ position: "absolute", left: g, top: y + 150, background: "rgba(11,20,28,.86)", border: `2px solid ${t.couleur}`, padding: "16px 24px 18px", display: "flex", flexDirection: "column", gap: 6, whiteSpace: "nowrap" }}>
        <b style={{ font: `800 46px/1 ${F.titre}`, color: t.couleur }}>{t.nom}</b>
        <span style={{ font: `500 21px ${F.mono}`, letterSpacing: ".12em", textTransform: "uppercase", color: "#e3eaef" }}>{t.coords}</span>
        <span style={{ font: `500 21px ${F.mono}`, letterSpacing: ".12em", textTransform: "uppercase", color: "#e3eaef" }}>{t.pastille}</span>
      </div>
    </>
  );
};
const Bloc = ({ t, largeur, style }) => (
  <div style={{ position: "absolute", display: "flex", flexDirection: "column", gap: 16, width: largeur, ...style }}>
    <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 12, background: t.couleur, color: "#0b141c", font: `800 34px ${F.titre}`, letterSpacing: ".04em", padding: "8px 24px", borderRadius: 40, marginBottom: 12 }}>
      <span style={{ width: 14, height: 14, borderRadius: 7, background: "#0b141c" }} />{t.pastille}</span>
    <div style={{ font: `800 ${t.nom.length > 12 ? 96 : 116}px/.95 ${F.titre}`, letterSpacing: "-.03em", color: "#fff" }}>{t.nom}</div>
    <div style={{ font: `700 56px/1.12 ${F.titre}`, color: "#fff" }}>{t.pays && <span style={{ color: t.couleur }}>{t.pays}</span>}{t.pays && <br />}{t.ligne2}</div>
    {t.faits.length > 0 && (
      <div style={{ display: "flex", gap: 36, marginTop: 6 }}>
        {t.faits.map(([ico, valeur, libelle]) => (
          <div key={libelle} style={{ display: "grid", gridTemplateColumns: "auto auto", columnGap: 14, rowGap: 4, alignItems: "center", justifyContent: "start" }}>
            <Ico n={ico} taille={46} couleur={t.couleur} /><b style={{ font: `800 62px/1 ${F.titre}`, color: "#fff", whiteSpace: "nowrap" }}>{valeur}</b>
            <span /><span style={{ font: `600 30px ${F.texte}`, color: "#c9d6df", whiteSpace: "nowrap" }}>{libelle}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);
const Pied = () => <div style={{ position: "absolute", right: 48, bottom: 34, font: `500 18px ${F.mono}`, letterSpacing: ".08em", color: "rgba(255,255,255,.7)" }}>liveatlas.earth</div>;

export const PostVolcan = ({ dossier, t, format }) => {
  const pret = usePolices(), d = useDonnees(dossier);
  if (!d || !pret) return <AbsoluteFill style={{ background: "#0b141c" }} />;
  if (format === "x") {
    const W = 1600, H = 900, cx = 0.71, cy = 0.38, zoom = 4, pt = projeter(d, W, H, cx, cy, zoom);
    return (
      <AbsoluteFill style={{ background: "#0b141c", overflow: "hidden" }}>
        <Carte d={d} W={W} H={H} cx={cx} cy={cy} zoom={zoom} couleur={t.couleur} mode="volcan" reserve={[[0, 0, W * 0.5, H], ...(pt ? [[pt[0] - 60, pt[1] + 120, pt[0] + 480, pt[1] + 300]] : [])]} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,#0b141c 0%,#0b141c 40%,rgba(11,20,28,.55) 47%,rgba(11,20,28,0) 56%)" }} />
        {pt && <Fiche t={t} x={pt[0]} y={pt[1]} W={W} />}
        <Haut t={t} largeur={860} />
        <Bloc t={t} largeur={860} style={{ left: 56, top: 170 }} />
        <Pied />
      </AbsoluteFill>
    );
  }
  const W = 1080, H = 1350, cy = 0.29, zoom = 4, pt = projeter(d, W, H, 0.5, cy, zoom);
  return (
    <AbsoluteFill style={{ background: "#0b141c", overflow: "hidden" }}>
      <Carte d={d} W={W} H={H} cx={0.5} cy={cy} zoom={zoom} couleur={t.couleur} mode="volcan" reserve={pt ? [[pt[0] - 60, pt[1] + 120, pt[0] + 480, pt[1] + 300]] : []} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(11,20,28,.8) 0%,rgba(11,20,28,0) 11%,rgba(11,20,28,0) 48%,rgba(11,20,28,.93) 60%,#0b141c 70%)" }} />
      {pt && <Fiche t={t} x={pt[0]} y={pt[1]} W={W} />}
      <Haut t={t} largeur={968} />
      <Bloc t={t} largeur={968} style={{ left: 56, bottom: 110 }} />
      <Pied />
    </AbsoluteFill>
  );
};
