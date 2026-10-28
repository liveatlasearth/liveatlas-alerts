// Shared pieces of the alert compositions: Live Atlas fonts and logo.
import React, { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

export const F = { titre: "Bricolage, sans-serif", texte: "Plex, sans-serif", mono: "Mono, monospace" };
export const nf = new Intl.NumberFormat("en-US");

// Charge les polices du site avant le rendu de la première image
export const usePolices = () => {
  const [h] = useState(() => delayRender("polices"));
  const [pret, setPret] = useState(false);
  useEffect(() => {
    const P = [["Bricolage", "bricolage-grotesque-latin-wght-normal.woff2", "200 800"], ["Plex", "ibm-plex-sans-latin-400-normal.woff2", "400"],
      ["Plex", "ibm-plex-sans-latin-600-normal.woff2", "600"], ["Mono", "ibm-plex-mono-latin-500-normal.woff2", "500"]];
    Promise.all(P.map(([nom, fichier, poids]) => new FontFace(nom, `url(${staticFile("polices/" + fichier)})`, { weight: poids }).load().then((f) => document.fonts.add(f))))
      .then(() => { setPret(true); continueRender(h); }).catch((e) => { console.error(e); setPret(true); continueRender(h); });
  }, [h]);
  return pret;
};

export const Logo = ({ taille = 44 }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="#f2a93b" strokeWidth="2" strokeLinecap="round">
    <rect width="24" height="24" rx="6" fill="#0b141c" stroke="none" /><circle cx="12" cy="12" r="8" />
    <path d="M4 12h16M12 4c2.7 2.8 2.7 13.2 0 16M12 4c-2.7 2.8-2.7 13.2 0 16" />
  </svg>
);

