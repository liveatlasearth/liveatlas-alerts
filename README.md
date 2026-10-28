# Live Atlas alerts

Alert engine of [Live Atlas](https://www.liveatlas.earth) for the @LiveAtlasQuakes accounts.

Every 10 minutes a GitHub Actions workflow reads the USGS real-time earthquake feed, keeps the events that pass the thresholds in `config/seuils.json`, and builds for each one:

- a 1080 × 1350 image (Instagram, Facebook) and a 1600 × 900 image (X), with a close-up map, the magnitude class color, local time and depth;
- a second image with the USGS ShakeMap intensity contours and the PAGER exposed population, when the USGS has published them;
- for magnitude 6.5 and up, a 30-second vertical reel with a calm ElevenLabs narration written from the USGS data;
- the captions for X, Instagram and Facebook.

Everything shown comes from official open data: USGS (event pages, ShakeMap, PAGER), NASA GIBS satellite imagery, Natural Earth countries, PB2002 plate boundaries. Nothing is invented. Posts relay information already published by the agencies and are not official warnings.

For now the engine runs in draft mode: each alert opens an issue with its captions and a link to the files. Direct publishing will be switched on once the platform keys are stored as repository secrets.

## Run it

```
npm ci
ELEVENLABS_API_KEY=… node src/principal.mjs            # normal run
ELEVENLABS_API_KEY=… node src/principal.mjs us6000u43g # one event by hand
npx remotion studio remotion/index.jsx                  # preview the compositions
```

Secrets: `ELEVENLABS_API_KEY` (reel narration). Later: Meta and X keys.

Remotion is used under its free license (company of three people or fewer). Icons: Lucide (ISC). Fonts: Bricolage Grotesque, IBM Plex Sans and Mono (SIL OFL).
