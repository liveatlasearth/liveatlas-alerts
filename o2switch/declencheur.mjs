// Fast trigger, run every 2 minutes by a cron on the Live Atlas server (o2switch).
// GitHub's own schedule often starts 10 to 20 minutes late: this script reads the USGS feed, and as soon as a new earthquake
// passes the thresholds (same rules as src/detecter.mjs, waiting time included), it starts the "Alerts" workflow right away.
// The GitHub token (fine-grained, this repository only, Actions read and write) is read from ~/.liveatlas-alerts-token,
// never stored in the repository. Already triggered events are remembered in ~/.liveatlas-alerts-vus.json.
// Cron: */2 * * * * cd ~/liveatlas-alerts && node o2switch/declencheur.mjs >> ~/logs/alertes-declencheur.log 2>&1
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { detecter } from "../src/detecter.mjs";

const JETON = join(homedir(), ".liveatlas-alerts-token"), VUS = join(homedir(), ".liveatlas-alerts-vus.json");
const DEPOT = "liveatlasearth/liveatlas-alerts", WORKFLOW = "alertes.yml";
if (!existsSync(JETON)) { console.log(new Date().toISOString(), "pas de jeton GitHub (~/.liveatlas-alerts-token)"); process.exit(0); }
const vus = existsSync(VUS) ? JSON.parse(readFileSync(VUS, "utf8")) : {};
// Same detection as the workflow, with what this trigger already saw as "done": only really new events start a run
const etat = Object.fromEntries(Object.entries(vus).map(([id, r]) => [id, Object.fromEntries(r.map((x) => [x, "vu"]))]));
const nouveaux = await detecter(etat);
if (!nouveaux.length) process.exit(0);
const r = await fetch(`https://api.github.com/repos/${DEPOT}/actions/workflows/${WORKFLOW}/dispatches`, {
  method: "POST",
  headers: { authorization: `Bearer ${readFileSync(JETON, "utf8").trim()}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "liveatlas-alerts-o2switch" },
  body: JSON.stringify({ ref: "main" }),
});
console.log(new Date().toISOString(), nouveaux.map((e) => `${e.id} M${e.mag} ${e.reseaux.join("+")}`).join(" ; "), "→ workflow", r.status === 204 ? "lancé" : `refusé ${r.status} ${await r.text()}`);
if (r.status === 204) {
  for (const e of nouveaux) vus[e.id] = [...new Set([...(vus[e.id] ?? []), ...e.reseaux])];
  // Keep two days of memory
  for (const id of Object.keys(vus)) if (!nouveaux.some((e) => e.id === id) && Object.keys(vus).length > 300) delete vus[id];
  writeFileSync(VUS, JSON.stringify(vus));
}
