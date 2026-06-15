import { writeFile, mkdir } from "fs/promises";
import path from "path";

const BASE_URL = "https://www.pharmaciens.tg/api/pharmcies";
const PAGE_SIZE = 100;
const OUTPUT_DIR = path.resolve("scripts/output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "pharmacies_togo.json");

async function fetchPage(page) {
  const url = `${BASE_URL}?populate=*&pagination[page]=${page}&pagination[pageSize]=${PAGE_SIZE}&sort[]=titre:asc`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Erreur HTTP ${res.status} pour la page ${page}`);
  }
  return res.json();
}

const all = [];
let page = 1;
let pageCount = 1;

do {
  console.log(`Récupération page ${page}...`);
  const json = await fetchPage(page);
  all.push(...json.data);
  pageCount = json.meta.pagination.pageCount;
  page++;
} while (page <= pageCount);

console.log(`Total enregistrements récupérés : ${all.length}`);

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT_FILE, JSON.stringify(all, null, 2), "utf-8");
console.log(`Écrit dans ${OUTPUT_FILE}`);
