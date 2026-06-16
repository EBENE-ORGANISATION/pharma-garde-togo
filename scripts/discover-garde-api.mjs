// Nécessite playwright (npm i -D playwright) pour être exécuté.
// Découvre l'endpoint API qui alimente la page des pharmacies de garde :
// https://www.pharmaciens.tg/on-call

import { chromium } from "playwright";

const TARGET_URL = "https://www.pharmaciens.tg/on-call";

const browser = await chromium.launch();
const page = await browser.newPage();

const jsonResponses = [];

page.on("response", async (response) => {
  const url = response.url();
  // On ne s'intéresse qu'aux appels /api/...
  if (!url.includes("/api/")) return;

  const status = response.status();
  const contentType = response.headers()["content-type"] || "";

  let body = null;
  try {
    const text = await response.text();
    // Tente de parser pour un affichage propre ; sinon garde le texte brut
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 2000);
    }
  } catch (err) {
    body = `<unable to read body: ${err.message}>`;
  }

  jsonResponses.push({ url, status, contentType, body });
});

console.log(`Navigation vers ${TARGET_URL} …`);
// "load" suffit — on attend ensuite manuellement que l'API de garde
// ait eu le temps de répondre (la page affiche d'abord "Chargement…").
await page.goto(TARGET_URL, { waitUntil: "load", timeout: 60000 });

// Attendre que le contenu dynamique soit chargé par l'API
await page.waitForTimeout(8000);

await browser.close();

// ---------------------------------------------------------------------------
// Rapport
// ---------------------------------------------------------------------------
console.log("\n==========================================");
console.log(`Total requêtes /api/ interceptées : ${jsonResponses.length}`);
console.log("==========================================\n");

for (const r of jsonResponses) {
  console.log("──────────────────────────────────────────");
  console.log("URL    :", r.url);
  console.log("Status :", r.status);
  console.log("Type   :", r.contentType);

  // Affiche un échantillon lisible de la réponse
  if (Array.isArray(r.body)) {
    console.log(`Tableau de ${r.body.length} éléments — 3 premiers :`);
    console.log(JSON.stringify(r.body.slice(0, 3), null, 2));
  } else if (r.body && typeof r.body === "object") {
    // Cherche le tableau principal s'il est imbriqué (ex. { data: [...] })
    const arrayKey = Object.keys(r.body).find((k) => Array.isArray(r.body[k]));
    if (arrayKey) {
      const arr = r.body[arrayKey];
      console.log(`Objet avec clé "${arrayKey}" (${arr.length} éléments) — 3 premiers :`);
      console.log(JSON.stringify(arr.slice(0, 3), null, 2));
      // Affiche les autres clés de premier niveau
      const meta = Object.fromEntries(Object.entries(r.body).filter(([k]) => k !== arrayKey));
      if (Object.keys(meta).length) console.log("Autres clés :", JSON.stringify(meta));
    } else {
      console.log("Corps (objet) :", JSON.stringify(r.body, null, 2).slice(0, 2000));
    }
  } else {
    console.log("Corps (brut) :", String(r.body).slice(0, 500));
  }
  console.log();
}
