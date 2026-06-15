// Nécessite playwright (npm i -D playwright) pour être exécuté.
import { chromium } from "playwright";

const TARGET_URL = "https://www.pharmaciens.tg/our-registry/pharmacies";

const browser = await chromium.launch();
const page = await browser.newPage();

const jsonResponses = [];

page.on("response", async (response) => {
  const headers = response.headers();
  const contentType = headers["content-type"] || "";
  if (!contentType.includes("application/json")) return;

  const url = response.url();
  const status = response.status();
  let bodySnippet = "";
  try {
    const text = await response.text();
    bodySnippet = text.slice(0, 1500);
  } catch (err) {
    bodySnippet = `<unable to read body: ${err.message}>`;
  }

  jsonResponses.push({ url, status, bodySnippet });
  console.log("----------------------------------------");
  console.log("URL:", url);
  console.log("Status:", status);
  console.log("Body snippet:", bodySnippet);
});

console.log(`Navigation vers ${TARGET_URL} ...`);
await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 60000 });

// Laisser le temps à des appels différés / pagination initiale de se déclencher
await page.waitForTimeout(3000);

await browser.close();

console.log("==========================================");
console.log(`Total réponses JSON interceptées : ${jsonResponses.length}`);
