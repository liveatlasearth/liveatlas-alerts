// Remotion entry of the alert engine: the earthquake reel and the still images.
import React from "react";
import { Composition, registerRoot } from "remotion";
import { AlerteSeisme } from "./AlerteSeisme.jsx";
import { PostSeisme } from "./PostSeisme.jsx";
import { PostVolcan, PhotoCarre, VueSatellite } from "./PostVolcan.jsx";
import { HebdoSeismes } from "./HebdoSeismes.jsx";
import { Rubrique } from "./Rubrique.jsx";
import { ReelLieu } from "./ReelLieu.jsx";

const vide = { dossier: "", t: {} };
const Racine = () => (
  <>
    <Composition id="alerte-seisme" component={AlerteSeisme} defaultProps={{ ...vide, S: {}, audio: { parle: [], fin: 900, musique: "" } }} calculateMetadata={({ props }) => ({ durationInFrames: props.audio.fin })} durationInFrames={900} fps={30} width={1080} height={1920} />
    <Composition id="post-carre" component={PostSeisme} defaultProps={{ ...vide, format: "carre" }} durationInFrames={1} fps={30} width={1080} height={1350} />
    <Composition id="post-x" component={PostSeisme} defaultProps={{ ...vide, format: "x" }} durationInFrames={1} fps={30} width={1600} height={900} />
    <Composition id="post-secousses" component={PostSeisme} defaultProps={{ ...vide, format: "secousses" }} durationInFrames={1} fps={30} width={1080} height={1350} />
    <Composition id="volcan-carre" component={PostVolcan} defaultProps={{ ...vide, format: "carre" }} durationInFrames={1} fps={30} width={1080} height={1350} />
    <Composition id="volcan-x" component={PostVolcan} defaultProps={{ ...vide, format: "x" }} durationInFrames={1} fps={30} width={1600} height={900} />
    <Composition id="volcan-satellite" component={VueSatellite} defaultProps={{ ...vide, t: { nom: "", couleur: "#F2A93B", satLigne: "" } }} durationInFrames={1} fps={30} width={1080} height={1350} />
    <Composition id="photo-carre" component={PhotoCarre} defaultProps={{ ...vide, t: { nom: "", couleur: "#F2A93B", photo: "", legende: "", credit: "" } }} durationInFrames={1} fps={30} width={1080} height={1350} />
    <Composition id="rubrique" component={Rubrique} defaultProps={{ dossier: "", t: { compte: "volcans", titre: "", points: [], lignes: [] } }} durationInFrames={1} fps={30} width={1080} height={1350} />
    <Composition id="hebdo-seismes" component={HebdoSeismes} defaultProps={{ d: null, scenes: [], couverture: 3, audio: { parle: [], fin: 900, voixDebut: 18 } }} calculateMetadata={({ props }) => ({ durationInFrames: props.audio.fin })} durationInFrames={900} fps={30} width={1080} height={1920} />
    <Composition id="reel-lieu" component={ReelLieu} defaultProps={{ dossier: "", d: { compte: "volcans", faits: [] }, scenes: [], couverture: 2, audio: { parle: [], fin: 600, voixDebut: 6 } }} calculateMetadata={({ props }) => ({ durationInFrames: props.audio.fin })} durationInFrames={600} fps={30} width={1080} height={1920} />
  </>
);
registerRoot(Racine);
