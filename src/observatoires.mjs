// Official alert levels of national volcano observatories that the Live Atlas site data does not carry (added Oct 30, 2026,
// after Mayon was raised to PHIVOLCS Level 3 and missed). Each source returns, for each volcano: its Smithsonian id (or a name
// and position to find it), a rank to compare levels, and the words shown. A raise to the threshold or above triggers a post.
// On the image the agency is never named ("3 of 5", "Alert Level"); the captions end with "Source: <agency>".
// Not used: Indonesia (MAGMA forbids robots), Chile (certificate chain of the API incomplete), Mexico (403), Colombia (JavaScript only),
// Costa Rica (image only), Ecuador and Guatemala (PDF or nothing), Papua New Guinea, DR Congo, Tonga (no official page online).
import { json } from "./commun.mjs";

const SITE = "https://www.liveatlas.earth", UA = { "user-agent": "liveatlas-alerts (+https://www.liveatlas.earth)" };
const page = async (url) => { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.text(); };
const COULEURS = ["green", "yellow", "orange", "red"], Maj = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// Words shown for a numbered scale (PHIVOLCS, VMGD: 0 to 5) and for a color scale (IMO, IGP: green to red; KVERT, INGV: aviation)
const chiffre = (n) => ({ rang: n, gravite: n, valeur: `${n} of 5`, libelle: "Alert Level", alerte: `Level ${n} of 5`, pastille: `Alert Level ${n}`, icone: "alert" });
const couleur = (c, texte) => { const r = COULEURS.indexOf(c.toLowerCase()); return { rang: r, gravite: r + 1, valeur: Maj(c), libelle: "Alert Level", alerte: texte ? `${Maj(c)} (${texte})` : Maj(c), pastille: `${Maj(c)} Alert`, icone: "alert" }; };
const aviation = (c) => { const r = COULEURS.indexOf(c.toLowerCase()); return { rang: r, gravite: r + 1, valeur: Maj(c), libelle: "Aviation Color Code", alerte: `Aviation Color Code ${Maj(c)}`, pastille: `Aviation Code ${Maj(c)}`, icone: "plane" }; };

export const SOURCES = [
  { cle: "phivolcs", organisme: "PHIVOLCS", pays: "Philippines", seuil: 3, zero: true, boite: [116, 4, 127, 21], lire: async () => {
    // "Alert Level Status" bar of the bulletin page: "Mayon - 3"
    const h = await page("https://wovodat.phivolcs.dost.gov.ph/bulletin/list-of-bulletin");
    return [...h.matchAll(/class="[^"]*scroll-item"\s*>\s*([^<]+?)\s*-\s*(\d)\s*</g)].map(([, nom, n]) => ({ nom: nom.trim(), ...chiffre(+n) }));
  } },
  { cle: "imo", organisme: "Icelandic Met Office", pays: "Islande", seuil: 2, lire: async () => {
    // Volcanic Alert Level System (green, yellow, orange, red), latest entry per volcano; the volcano list gives the Smithsonian id
    const [liste, vals] = await Promise.all([json("https://api.vedur.is/volcanoes/volcanoes"), json("https://api.vedur.is/volcanoes/vals")]);
    const dernier = {}; for (const x of vals) if (!dernier[x.volcano_code] || x.published_at > dernier[x.volcano_code].published_at) dernier[x.volcano_code] = x;
    return Object.values(dernier).map((x) => { const v = liste.find((y) => y.code === x.volcano_code); const a = x.alert_level_info;
      return v?.si_code && { gvp: +v.si_code, nom: v.name, ...couleur(a.code_en, a.description_en) }; }).filter(Boolean);
  } },
  { cle: "vmgd", organisme: "VMGD", pays: "Vanuatu", seuil: 3, lire: async () => {
    // Volcanic Alert Level 0 to 5, in the page data of the volcano list
    const h = (await page("https://www.vmgd.gov.vu/geohazards/volcanoes")).replace(/\\"/g, '"');
    const vus = new Map();
    for (const [, nom, n, lon, lat] of h.matchAll(/"name":"([^"]+)","alertLevel":(\d),"island":(?:null|"[^"]*"),"type":"[^"]*","longitude":([-\d.]+),"latitude":([-\d.]+)/g)) vus.set(nom, { nom, lon: +lon, lat: +lat, ...chiffre(+n) });
    return [...vus.values()];
  } },
  { cle: "igp", organisme: "IGP", pays: "Pérou", seuil: 2, lire: async () => {
    // Volcanic alert color of the national volcano center (verde, amarilla, naranja, roja)
    const ES = { verde: "green", amarilla: "yellow", naranja: "orange", roja: "red" };
    return (await json("https://cenvul.igp.gob.pe/backend/api/volcanoes?populate=status")).data
      .filter((v) => ES[v.status?.color?.toLowerCase()]).map((v) => ({ nom: v.name, lon: v.longitud, lat: v.latitud, ...couleur(ES[v.status.color.toLowerCase()]) }));
  } },
  { cle: "kvert", organisme: "KVERT", pays: "Russie", seuil: 2, boite: [140, 41, 170, 62], lire: async () => {
    // "SUMMARY OF AVIATION COLOUR CODES" of the Kamchatka team (plain HTTP only): "SHEVELUCH: ORANGE", "A, B, C: GREEN"
    const t = (await page("http://kvert.febras.net/")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    const resume = t.match(/SUMMARY OF AVIATION COLOU?R CODES(.*?)(?:Kamchatka Volcanic Eruption Response Team|$)/i)?.[1] ?? "";
    return [...resume.matchAll(/([A-Z][A-Z ,'-]+?):\s*(GREEN|YELLOW|ORANGE|RED)\b/g)].flatMap(([, noms, c]) =>
      noms.replace(/^(KAMCHATKA|NORTHERN KURILES|CENTRAL KURILES|SOUTHERN KURILES)\s+/, "").split(",").map((n) => ({ nom: n.trim(), ...aviation(c) })));
  } },
  { cle: "ingv", organisme: "INGV", pays: "Italie", seuil: 3, delai: 7 * 86400e3, boite: [6, 36, 19, 47], lire: async () => {
    // Latest VONA per volcano (Etna, Stromboli). Red only, and one post per volcano per 7 days at most: Etna turns red several times a month
    const h = await page("https://www.ct.ingv.it/sezioniesterne/Comunicati/ComunicatiVonaN.php"), vus = new Map();
    for (const [, nom, date, c] of h.matchAll(/<td[^>]*>([A-Z ]+)<\/td><td[^>]*>(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)<\/td><td[^>]*>Aviation Color Code:\s*(GREEN|YELLOW|ORANGE|RED)/g))
      if (!vus.has(nom)) vus.set(nom, { nom: Maj(nom), date, ...aviation(c) });
    return [...vus.values()];
  } },
  { cle: "ovpf", organisme: "OVPF-IPGP", pays: "France", seuil: 2, boite: [55, -22, 56, -20.5], lire: async () => {
    // Alert level of Piton de la Fournaise set by the prefecture, as given by the observatory: the daily bulletin and the communiqués
    // (each tagged "Alerte : 1"); the most recent of the two wins. Vigilance, Alerte 1 (eruption likely), Alerte 2-1 / 2-2 (eruption), Sauvegarde
    const RANG = { vigilance: 1, "1": 2, "2-1": 3, "2-2": 4, sauvegarde: 5 }, texte = (h) => h.replace(/<[^>]*>/g, " ").replace(/&nbsp;|\s+/g, " ");
    const [b, c] = await Promise.all([page("https://www.ipgp.fr/volcanoweb/reunion/Bulletin_quotidien/bulletin.html"), page("https://www.ipgp.fr/communiques-et-bulletins-de-lobservatoire/?observatoire-associe=391")]);
    const lus = [];
    const mb = texte(b).match(/cr&eacute;&eacute; le (\d\d)-(\d\d)-(\d{4}) (\d\d:\d\d):\d\d TU.*?Niveau d'alerte : (Vigilance|Alerte [\d-]+|Sauvegarde)/i);
    if (mb) lus.push({ quand: Date.parse(`${mb[3]}-${mb[2]}-${mb[1]}T${mb[4]}:00Z`), niveau: mb[5] });
    // Communiqués: newest first, the time is in the PDF name (Réunion time, UTC+4)
    for (const [, a, mo, j, hh, mm, niveau] of c.matchAll(/OVPF_(\d{4})(\d\d)(\d\d)_(\d\d)h(\d\d)[^"]*\.pdf"[^>]*>[\s\S]*?Alerte\s*:\s*(?:<[^>]*>\s*)*(Vigilance|[\d-]+|Sauvegarde)/g))
      lus.push({ quand: Date.parse(`${a}-${mo}-${j}T${hh}:${mm}:00+04:00`), niveau: /^[\d-]+$/.test(niveau) ? `Alerte ${niveau}` : niveau });
    const n = lus.sort((x, y) => y.quand - x.quand)[0]; if (!n) return [];
    const cle = n.niveau.toLowerCase().replace(/^alerte /, ""), rang = RANG[cle]; if (!rang) return [];
    const en = n.niveau.replace(/^Alerte/, "Alert").replace("Sauvegarde", "Safeguard");
    return [{ nom: "Piton de la Fournaise", rang, gravite: rang >= 5 ? 5 : rang >= 3 ? 4 : 3, valeur: en, libelle: "Alert Level", alerte: en, pastille: en, icone: "alert" }];
  } },
];

const km = ([lo1, la1], [lo2, la2]) => { const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(a)); };
const simple = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^(mount|mont|volcan|volcano)\s+/, "").replace(/\s*\(.*\)$/, "").trim();

// Adds the national alert levels to the volcano list (volcanoes missing from the site events are added from the public volcano map).
// A source that fails is skipped: its remembered levels stay, nothing is posted from it
export async function ajouterObservatoires(volcans) {
  let carte, anglais;
  const reference = async () => { carte ??= await json(`${SITE}/donnees/volcans-carte.json`); anglais ??= await json(`${SITE}/donnees/volcans-en.json`); };
  for (const s of SOURCES) {
    let liste;
    try { liste = await s.lire(); } catch (e) { console.log(`${s.organisme} : indisponible (${e.message}), niveaux en mémoire gardés`); continue; }
    if (!liste.length) { console.log(`${s.organisme} : aucun niveau lu, niveaux en mémoire gardés`); continue; }
    await reference();
    for (const x of liste) {
      // Smithsonian id given, else the nearest volcano within 25 km, else the same name (French or English) inside the source's box
      let c = x.gvp ? carte.find((y) => y[0] === x.gvp) : null;
      if (!c && x.lon != null) c = carte.map((y) => [km([x.lon, x.lat], [y[2], y[3]]), y]).filter(([d]) => d < 25).sort((a, b) => a[0] - b[0])[0]?.[1];
      if (!c && s.boite) { const [o, su, e, n] = s.boite, nom = simple(x.nom);
        c = carte.find((y) => y[2] > o && y[2] < e && y[3] > su && y[3] < n && (simple(y[1]) === nom || simple(anglais[y[0]]?.[0] ?? "") === nom)); }
      if (!c) { if (x.rang >= s.seuil - 1) console.log(`${s.organisme} : ${x.nom} introuvable dans la carte des volcans`); continue; }
      let v = volcans.find((y) => +y.id === c[0]);
      if (!v) { v = { id: c[0], nom: c[1], slug: c[7], pays: s.pays, lon: c[2], lat: c[3], statut: "repos", depuis: null, alertes: [] }; volcans.push(v); }
      v.alertes = [...(v.alertes ?? []), { ...x, organisme: s.organisme, cle: s.cle, seuil: s.seuil, delai: s.delai ?? 0, zero: !!s.zero, nom: undefined, lon: undefined, lat: undefined, gvp: undefined }];
    }
  }
  return volcans;
}
