// Narration with ElevenLabs (text to speech with word timings). The key comes from the ELEVENLABS_API_KEY secret, never from the code.
import { writeFileSync } from "node:fs";

export const VOIX = { chris: "iP95p4xoKVk53GoZ742B" }; // calm natural American voice used for the alert reels

// Group character timings into words, leaving out [audio tags]
const enMots = (al) => {
  const mots = []; let cur = "", debut = null, fin = null, tag = false;
  al.characters.forEach((ch, i) => {
    if (ch === "[") tag = true;
    if (tag) { if (ch === "]") tag = false; return; }
    if (/\s/.test(ch)) { if (cur.trim()) mots.push({ word: cur.trim(), start: debut, end: fin }); cur = ""; debut = null; return; }
    if (debut === null) debut = al.character_start_times_seconds[i];
    cur += ch; fin = al.character_end_times_seconds[i];
  });
  if (cur.trim()) mots.push({ word: cur.trim(), start: debut, end: fin });
  return mots;
};

export async function voix(texte, sortieMp3, voix = "chris") {
  const cle = process.env.ELEVENLABS_API_KEY;
  if (!cle) throw new Error("ELEVENLABS_API_KEY manquante");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOIX[voix]}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": cle, "content-type": "application/json" },
    body: JSON.stringify({ text: texte, model_id: "eleven_v4", language_code: "en", voice_settings: { stability: 0.4 } }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status} ${await r.text()}`);
  const j = await r.json();
  writeFileSync(sortieMp3, Buffer.from(j.audio_base64, "base64"));
  return enMots(j.alignment ?? j.normalized_alignment);
}
