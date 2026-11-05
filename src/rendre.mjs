// Renders the images and the reel of one earthquake with Remotion. The reel scenes follow the narration (one paragraph = one scene).
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { geoDistance } from "d3-geo";
import { RACINE } from "./commun.mjs";
import { voix } from "./voix.mjs";

let serveUrl = null;
export async function preparer() {
  serveUrl ??= await bundle({ entryPoint: join(RACINE, "remotion", "index.jsx"), publicDir: join(RACINE, "public") });
  return serveUrl;
}
// The bundle holds a copy of public/ made when it was built: files of each event are copied in just before rendering
const synchroniser = (id) => cpSync(join(RACINE, "public", "evenements", id), join(serveUrl, "public", "evenements", id), { recursive: true });
// Remotion's ffmpeg; on Windows (run through the shell) the paths with spaces need quotes
const ffmpeg = (args) => execFileSync("npx", ["remotion", "ffmpeg", ...(process.platform === "win32" ? args.map((a) => (/\s/.test(a) ?`"${a}"` : a)) : args)], { shell: process.platform === "win32", cwd: RACINE });
export const fermer = () => { if (serveUrl) rmSync(serveUrl, { recursive: true, force: true }); serveUrl = null; };

// Zoom that frames the "moderate shaking" (V) contour of the ShakeMap at about 330 px from the epicenter
const zoomSecousses = (d) => {
  const cont = d.shakemap?.features.find((f) => f.properties.mmi === 5) ?? d.shakemap?.features[0];
  if (!cont) return 12;
  let max = 0; JSON.stringify(cont.geometry.coordinates).match(/-?\d+\.?\d*,-?\d+\.?\d*/g).forEach((t) => { const [x, y] = t.split(",").map(Number); max = Math.max(max, geoDistance([x, y], [d.lon, d.lat])); });
  return Math.max(4, Math.min(40, 330 / Math.max(max, 1e-3) / (1080 * 0.47)));
};

export async function images(d, ecran, sortie) {
  const url = await preparer(), dossier = `evenements/${d.id}`, t = { ...ecran, zoomSecousses: zoomSecousses(d) }, faits = [];
  synchroniser(d.id);
  mkdirSync(sortie, { recursive: true });
  for (const [id, fichier, si] of [["post-carre", "post-4x5.jpg", true], ["post-x", "post-16x9.jpg", true], ["post-secousses", "post-4x5-secousses.jpg", d.shakemap && d.villes.length && t.exposes]]) {
    if (!si) continue;
    const inputProps = { dossier, t }, composition = await selectComposition({ serveUrl: url, id, inputProps });
    await renderStill({ composition, serveUrl: url, frame: 0, inputProps, output: join(sortie, fichier), imageFormat: "jpeg", jpegQuality: 92 });
    faits.push(fichier);
  }
  return faits;
}

export async function imagesVolcan(d, ecran, sortie) {
  const url = await preparer(), dossier = `evenements/${d.id}`, faits = [];
  synchroniser(d.id); mkdirSync(sortie, { recursive: true });
  for (const [id, fichier] of [["volcan-carre", "post-4x5.jpg"], ["volcan-x", "post-16x9.jpg"]]) {
    const inputProps = { dossier, t: ecran }, composition = await selectComposition({ serveUrl: url, id, inputProps });
    await renderStill({ composition, serveUrl: url, frame: 0, inputProps, output: join(sortie, fichier), imageFormat: "jpeg", jpegQuality: 92 });
    faits.push(fichier);
  }
  return faits;
}

// Regular posts (src/rubriques.mjs): one 1080 × 1350 image, "rubrique" (world map and list), "volcan-carre" (one place card)
// or "volcan-satellite" (the second image, seen from space)
export async function imageRubrique(id, composition, t, sortie, fichier = "post-4x5.jpg") {
  const url = await preparer(), inputProps = { dossier: `evenements/${id}`, t };
  synchroniser(id); mkdirSync(sortie, { recursive: true });
  const c = await selectComposition({ serveUrl: url, id: composition, inputProps });
  await renderStill({ composition: c, serveUrl: url, frame: 0, inputProps, output: join(sortie, fichier), imageFormat: "jpeg", jpegQuality: 92 });
  return [fichier];
}

export async function reel(d, ecran, narration, sortie) {
  const url = await preparer(), dossier = `evenements/${d.id}`;
  mkdirSync(sortie, { recursive: true });
  const mots = await voix(narration, join(RACINE, "public", dossier, "voix.mp3"));
  synchroniser(d.id);
  const paras = narration.replace(/\[[^\]]*\]/g, "").trim().split(/\n\s*\n/).map((p) => p.trim().split(/\s+/).length);
  const debuts = []; let i = 0; for (const n of paras) { debuts.push(mots[i].start); i += n; }
  const VO = 18, fr = (s) => Math.round(VO + s * 30) - 8;
  // Satellite view kept 0.5 s longer and shaking zones 0.7 s longer (they overlap the next sentence a little)
  const S = { B: fr(debuts[1]), C: fr(debuts[2]), D: fr(debuts[3]) + 15, E: fr(debuts[4]) + 20, F: fr(debuts[5]) };
  const fin = Math.round(VO + mots.at(-1).end * 30) + 80;
  const parle = []; for (const m of mots) { const a = Math.round(VO + m.start * 30), b = Math.round(VO + m.end * 30); if (parle.length && a - parle.at(-1)[1] < 11) parle.at(-1)[1] = b; else parle.push([a, b]); }
  const inputProps = { dossier, t: ecran, S, audio: { voixDebut: VO, parle, fin, musique: "musique/calme-1.mp3" } };
  const composition = await selectComposition({ serveUrl: url, id: "alerte-seisme", inputProps });
  await renderStill({ composition, serveUrl: url, frame: 90, inputProps, output: join(sortie, "reel-cover-9x16.jpg"), imageFormat: "jpeg", jpegQuality: 92 });
  const brut = join(sortie, "_brut.mp4");
  await renderMedia({ composition, serveUrl: url, codec: "h264", crf: 18, pixelFormat: "yuv420p", inputProps, outputLocation: brut });
  // ffmpeg bundled with Remotion (no install on the runner): sound normalized for the networks (-14 LUFS)
  ffmpeg(["-y", "-loglevel", "error", "-i", brut, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", join(sortie, "reel.mp4")]);
  rmSync(brut);
  return ["reel.mp4", "reel-cover-9x16.jpg"];
}

// Weekly reel: scenes follow the narration paragraphs (hook, classes, strongest, busiest, deepest and/or most felt, end)
export async function reelHebdo(d, narration, sortie) {
  const url = await preparer(), dossier = `evenements/${d.id}`;
  mkdirSync(join(RACINE, "public", dossier), { recursive: true }); mkdirSync(sortie, { recursive: true });
  // ESSAI_SANS_VOIX=1: local test without the ElevenLabs key, words timed at 2.6 per second, no voice track
  const sansVoix = process.env.ESSAI_SANS_VOIX === "1";
  const mots = sansVoix ? narration.split(/\s+/).filter(Boolean).map((w, j) => ({ word: w, start: j / 2.6, end: j / 2.6 + 0.35 }))
    : await voix(narration, join(RACINE, "public", dossier, "voix.mp3"));
  synchroniser(d.id);
  const paras = narration.trim().split(/\n\s*\n/).map((p) => p.trim().split(/\s+/).length);
  const debuts = []; let i = 0; for (const n of paras) { debuts.push(mots[i].start); i += n; }
  // First word at about 0.2 s (whatever the silence at the start of the voice file): the narration starts with the video
  const VO = Math.max(0, Math.round(6 - mots[0].start * 30)), sec = (s) => (VO + s * 30 - 8) / 30, fin = Math.round(VO + mots.at(-1).end * 30) + 80;
  const types = ["accroche", "classes", "fort", "actif", ...(d.mode === "deux" ? ["profond", "ressenti"] : [d.mode]), "fin"];
  const scenes = types.map((type, j) => ({ type, de: j ? Math.max(sec(debuts[j]), j === 1 ? 2.8 : 0) : 0 }));
  scenes.forEach((s, j) => { s.a = j < scenes.length - 1 ? scenes[j + 1].de : fin / 30; });
  const parle = []; for (const m of mots) { const a = Math.round(VO + m.start * 30), b = Math.round(VO + m.end * 30); if (parle.length && a - parle.at(-1)[1] < 11) parle.at(-1)[1] = b; else parle.push([a, b]); }
  const inputProps = { d, scenes, couverture: scenes[0].a - 0.2, audio: { voix: sansVoix ? null : `${dossier}/voix.mp3`, voixDebut: VO, parle, fin, musique: "musique/calme-1.mp3" } };
  const composition = await selectComposition({ serveUrl: url, id: "hebdo-seismes", inputProps });
  await renderStill({ composition, serveUrl: url, frame: 0, inputProps, output: join(sortie, "reel-cover-9x16.jpg"), imageFormat: "jpeg", jpegQuality: 92 });
  const brut = join(sortie, "_brut.mp4");
  await renderMedia({ composition, serveUrl: url, codec: "h264", crf: 18, pixelFormat: "yuv420p", inputProps, outputLocation: brut });
  ffmpeg(["-y", "-loglevel", "error", "-i", brut, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", join(sortie, "reel.mp4")]);
  rmSync(brut);
  return ["reel.mp4", "reel-cover-9x16.jpg"];
}

// Reel of one place for the regular posts (remotion/ReelLieu.jsx): photos, map, figures, time line, aftershocks, view from
// space, end card, one narration paragraph each. Same voice and loudness as the weekly reel, music chosen by the post.
export async function reelLieu(id, d, liste, sortie, musique = "musique/calme-1.mp3") {
  // liste: one scene per narration paragraph, { type, texte, ...data of the scene } (remotion/ReelLieu.jsx)
  const narration = liste.map((s) => s.texte).join("\n\n");
  const url = await preparer(), dossier = `evenements/${id}`;
  mkdirSync(join(RACINE, "public", dossier), { recursive: true }); mkdirSync(sortie, { recursive: true });
  const sansVoix = process.env.ESSAI_SANS_VOIX === "1";
  const mots = sansVoix ? narration.split(/\s+/).filter(Boolean).map((w, j) => ({ word: w, start: j / 2.6, end: j / 2.6 + 0.35 }))
    : await voix(narration, join(RACINE, "public", dossier, "voix.mp3"));
  synchroniser(id);
  const paras = narration.trim().split(/\n\s*\n/).map((p) => p.trim().split(/\s+/).length);
  const debuts = []; let i = 0; for (const n of paras) { debuts.push(mots[i].start); i += n; }
  const VO = Math.max(0, Math.round(6 - mots[0].start * 30)), sec = (s) => (VO + s * 30 - 8) / 30, fin = Math.round(VO + mots.at(-1).end * 30) + 50;
  // The hook stays at least 2.5 s, so the title can be read
  const scenes = liste.map(({ texte, ...s }, j) => ({ ...s, de: j ? Math.max(sec(debuts[j]), j === 1 ? 2.5 : 0) : 0 }));
  scenes.forEach((s, j) => { s.a = j < scenes.length - 1 ? scenes[j + 1].de : fin / 30; });
  const parle = []; for (const m of mots) { const a = Math.round(VO + m.start * 30), b = Math.round(VO + m.end * 30); if (parle.length && a - parle.at(-1)[1] < 11) parle.at(-1)[1] = b; else parle.push([a, b]); }
  const inputProps = { dossier, d, scenes, couverture: scenes[0].a - 0.2, audio: { voix: sansVoix ? null : `${dossier}/voix.mp3`, voixDebut: VO, parle, fin, musique } };
  const composition = await selectComposition({ serveUrl: url, id: "reel-lieu", inputProps });
  await renderStill({ composition, serveUrl: url, frame: 0, inputProps, output: join(sortie, "reel-cover-9x16.jpg"), imageFormat: "jpeg", jpegQuality: 92 });
  const brut = join(sortie, "_brut.mp4");
  await renderMedia({ composition, serveUrl: url, codec: "h264", crf: 18, pixelFormat: "yuv420p", inputProps, outputLocation: brut });
  ffmpeg(["-y", "-loglevel", "error", "-i", brut, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", join(sortie, "reel.mp4")]);
  rmSync(brut);
  return ["reel.mp4", "reel-cover-9x16.jpg"];
}
