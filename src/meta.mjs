// Publishing on Facebook and Instagram with the Meta Graph API (v26.0), from the public release URLs of the files.
// Secret: META_PAGE_TOKEN_SEISMES (Page access token of the earthquake Page). The Page id and the linked Instagram
// professional account id are read from the API with that token, nothing else is needed.
// Reel: Facebook Reels Publishing API (video_reels) and Instagram REELS container. Images: Facebook multi-photo post and Instagram carousel.
const API = "https://graph.facebook.com/v26.0";

async function graph(chemin, params = {}, methode = "POST", jeton) {
  const url = new URL(API + chemin), corps = new URLSearchParams({ ...params, access_token: jeton });
  const r = methode === "GET" ? await fetch(`${url}?${corps}`) : await fetch(url, { method: "POST", body: corps });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`Meta ${chemin} : ${j.error?.message ?? r.status}`);
  return j;
}
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Accepts a Page token or a user token: with a user token, the Page whose name matches (default "Earthquake") is picked
// in /me/accounts and its own Page token is used for publishing.
export async function comptes(jeton, nom = process.env.META_PAGE_NOM || "Earthquake") {
  let pages = null;
  try { pages = (await graph("/me/accounts", { fields: "id,name,access_token,instagram_business_account" }, "GET", jeton)).data; } catch {}
  if (pages?.length) {
    const p = pages.find((x) => x.name.toLowerCase().includes(nom.toLowerCase()));
    if (!p) throw new Error(`Aucune page « ${nom} » parmi : ${pages.map((x) => x.name).join(", ")}`);
    return { page: p.id, nomPage: p.name, ig: p.instagram_business_account?.id ?? null, jeton: p.access_token };
  }
  const page = await graph("/me", { fields: "id,name,instagram_business_account" }, "GET", jeton);
  return { page: page.id, nomPage: page.name, ig: page.instagram_business_account?.id ?? null, jeton };
}

// Instagram: wait until the container is ready, then publish; returns the permalink
async function publierIg(ig, conteneur, jeton) {
  for (let i = 0; i < 60; i++) {
    const s = await graph(`/${conteneur}`, { fields: "status_code,status" }, "GET", jeton);
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram : traitement refusé (${s.status})`);
    await pause(10000);
  }
  const { id } = await graph(`/${ig}/media_publish`, { creation_id: conteneur }, "POST", jeton);
  return (await graph(`/${id}`, { fields: "permalink" }, "GET", jeton)).permalink;
}

export async function reelInstagram({ ig }, videoUrl, couvertureUrl, legende, jeton) {
  const c = await graph(`/${ig}/media`, { media_type: "REELS", video_url: videoUrl, cover_url: couvertureUrl, caption: legende, share_to_feed: "true" }, "POST", jeton);
  return publierIg(ig, c.id, jeton);
}

export async function carrouselInstagram({ ig }, imagesUrl, legende, jeton) {
  if (imagesUrl.length === 1) { const c = await graph(`/${ig}/media`, { image_url: imagesUrl[0], caption: legende }, "POST", jeton); return publierIg(ig, c.id, jeton); }
  const enfants = [];
  for (const u of imagesUrl) enfants.push((await graph(`/${ig}/media`, { image_url: u, is_carousel_item: "true" }, "POST", jeton)).id);
  const c = await graph(`/${ig}/media`, { media_type: "CAROUSEL", children: enfants.join(","), caption: legende }, "POST", jeton);
  return publierIg(ig, c.id, jeton);
}

export async function reelFacebook({ page }, videoUrl, legende, jeton) {
  const { video_id } = await graph(`/${page}/video_reels`, { upload_phase: "start" }, "POST", jeton);
  const r = await fetch(`https://rupload.facebook.com/video-upload/v26.0/${video_id}`, { method: "POST", headers: { Authorization: `OAuth ${jeton}`, file_url: videoUrl } });
  if (!r.ok) throw new Error(`Facebook : envoi de la vidéo refusé (${r.status} ${await r.text()})`);
  for (let i = 0; i < 60; i++) {
    const s = await graph(`/${video_id}`, { fields: "status" }, "GET", jeton);
    if (s.status?.uploading_phase?.status === "complete") break;
    if (s.status?.video_status === "error") throw new Error("Facebook : vidéo refusée");
    await pause(5000);
  }
  await graph(`/${page}/video_reels`, { video_id, upload_phase: "finish", video_state: "PUBLISHED", description: legende }, "POST", jeton);
  return `https://www.facebook.com/reel/${video_id}`;
}

export async function photosFacebook({ page }, imagesUrl, legende, jeton) {
  const ids = [];
  for (const u of imagesUrl) ids.push((await graph(`/${page}/photos`, { url: u, published: "false" }, "POST", jeton)).id);
  const params = { message: legende }; ids.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
  const { id } = await graph(`/${page}/feed`, params, "POST", jeton);
  return `https://www.facebook.com/${id}`;
}
