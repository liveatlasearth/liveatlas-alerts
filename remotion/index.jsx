// Remotion entry of the alert engine: the earthquake reel and the still images.
import React from "react";
import { Composition, registerRoot } from "remotion";
import { AlerteSeisme } from "./AlerteSeisme.jsx";
import { PostSeisme } from "./PostSeisme.jsx";
import { PostVolcan } from "./PostVolcan.jsx";

const vide = { dossier: "", t: {} };
const Racine = () => (
  <>
    <Composition id="alerte-seisme" component={AlerteSeisme} defaultProps={{ ...vide, S: {}, audio: { parle: [], fin: 900, musique: "" } }} calculateMetadata={({ props }) => ({ durationInFrames: props.audio.fin })} durationInFrames={900} fps={30} width={1080} height={1920} />
    <Composition id="post-carre" component={PostSeisme} defaultProps={{ ...vide, format: "carre" }} durationInFrames={1} fps={30} width={1080} height={1350} />
    <Composition id="post-x" component={PostSeisme} defaultProps={{ ...vide, format: "x" }} durationInFrames={1} fps={30} width={1600} height={900} />
    <Composition id="post-secousses" component={PostSeisme} defaultProps={{ ...vide, format: "secousses" }} durationInFrames={1} fps={30} width={1080} height={1350} />
    <Composition id="volcan-carre" component={PostVolcan} defaultProps={{ ...vide, format: "carre" }} durationInFrames={1} fps={30} width={1080} height={1350} />
    <Composition id="volcan-x" component={PostVolcan} defaultProps={{ ...vide, format: "x" }} durationInFrames={1} fps={30} width={1600} height={900} />
  </>
);
registerRoot(Racine);
