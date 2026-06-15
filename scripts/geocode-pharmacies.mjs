// Associe les pharmacies de notre annuaire (scripts/output/pharmacies_togo.json)
// aux points "amenity=pharmacy" d'OpenStreetMap, par correspondance de nom.
//
// Ne modifie PAS la base de données : produit uniquement
//   - scripts/output/pharmacies_geo.sql  (UPDATE ... WHERE slug = ... AND latitude IS NULL)
//   - un rapport sur la console
//
// Usage : node scripts/geocode-pharmacies.mjs

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const INPUT_FILE = path.resolve("scripts/output/pharmacies_togo.json");
const OUTPUT_DIR = path.resolve("scripts/output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "pharmacies_geo.sql");

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const OVERPASS_QUERY = `[out:json][timeout:60];
area["ISO3166-1"="TG"][admin_level=2]->.tg;
(
  node["amenity"="pharmacy"](area.tg);
  way["amenity"="pharmacy"](area.tg);
  relation["amenity"="pharmacy"](area.tg);
);
out center tags;`;

// Seuil de similarité (Dice sur bigrammes) en dessous duquel on refuse
// d'associer. Volontairement strict : appli de santé, mieux vaut un
// "non associé" qu'une coordonnée fausse.
const SIMILARITY_THRESHOLD = 0.88;

// ---------------------------------------------------------------------------
// Normalisation des noms
// ---------------------------------------------------------------------------

const GENERIC_WORDS = /\b(pharmacie|pharmacy|phie|phcie)\b/g;

function normalizeName(raw) {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // enlève les accents
    .replace(GENERIC_WORDS, " ")
    .replace(/[^a-z0-9\s]/g, " ") // ponctuation -> espace
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Similarité : coefficient de Dice sur bigrammes de caractères
// ---------------------------------------------------------------------------

function bigrams(str) {
  const s = str.replace(/\s+/g, "");
  const grams = [];
  for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
  return grams;
}

function diceCoefficient(a, b) {
  if (a === b) return 1;
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.length === 0 || gb.length === 0) return 0;
  const gbRemaining = [...gb];
  let matches = 0;
  for (const g of ga) {
    const idx = gbRemaining.indexOf(g);
    if (idx !== -1) {
      matches++;
      gbRemaining.splice(idx, 1);
    }
  }
  return (2 * matches) / (ga.length + gb.length);
}

// ---------------------------------------------------------------------------
// Chargement de notre annuaire
// ---------------------------------------------------------------------------

const raw = await readFile(INPUT_FILE, "utf-8");
const data = JSON.parse(raw);

const pharmacies = data
  .map((p) => ({
    // Même logique que scripts/generate-sql.mjs : le slug vient du champ
    // `slug` fourni par l'export, le nom est `titre` avec espaces normalisés.
    slug: p.slug,
    nom: (p.titre || "").replace(/\s+/g, " ").trim(),
  }))
  .filter((p) => p.slug && p.nom);

for (const p of pharmacies) {
  p.normalized = normalizeName(p.nom);
}

// ---------------------------------------------------------------------------
// Récupération des points OSM
// ---------------------------------------------------------------------------

console.log("Interrogation d'Overpass API…");
const response = await fetch(OVERPASS_ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "*/*",
    "User-Agent": "pharma-garde-togo-geocode-script/1.0",
  },
  body: "data=" + encodeURIComponent(OVERPASS_QUERY),
});

if (!response.ok) {
  throw new Error(`Overpass API a répondu ${response.status} ${response.statusText}`);
}

const osmJson = await response.json();
const osmElements = osmJson.elements || [];

const osmPoints = [];
for (const el of osmElements) {
  const name = el.tags && el.tags.name;
  if (!name) continue;

  let lat, lon;
  if (el.type === "node") {
    lat = el.lat;
    lon = el.lon;
  } else if (el.center) {
    lat = el.center.lat;
    lon = el.center.lon;
  }
  if (lat == null || lon == null) continue;

  osmPoints.push({
    name,
    normalized: normalizeName(name),
    lat,
    lon,
    used: false,
  });
}

// ---------------------------------------------------------------------------
// Association
// ---------------------------------------------------------------------------

const matches = []; // { pharmacy, osmPoint, score }

// Passe 1 : correspondance exacte du nom normalisé (priorité absolue)
for (const pharmacy of pharmacies) {
  if (!pharmacy.normalized) continue;
  const candidate = osmPoints.find((o) => !o.used && o.normalized === pharmacy.normalized);
  if (candidate) {
    candidate.used = true;
    matches.push({ pharmacy, osmPoint: candidate, score: 1 });
  }
}

// Passe 2 : similarité (Dice) >= seuil, pour les pharmacies restantes
const matchedSlugs = new Set(matches.map((m) => m.pharmacy.slug));
for (const pharmacy of pharmacies) {
  if (matchedSlugs.has(pharmacy.slug)) continue;
  if (!pharmacy.normalized) continue;

  let best = null;
  let bestScore = 0;
  for (const o of osmPoints) {
    if (o.used) continue;
    const score = diceCoefficient(pharmacy.normalized, o.normalized);
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }

  if (best && bestScore >= SIMILARITY_THRESHOLD) {
    best.used = true;
    matches.push({ pharmacy, osmPoint: best, score: bestScore });
    matchedSlugs.add(pharmacy.slug);
  }
}

// ---------------------------------------------------------------------------
// Sortie SQL
// ---------------------------------------------------------------------------

const sqlLines = matches.map(
  (m) =>
    `update public.pharmacies set latitude=${m.osmPoint.lat}, longitude=${m.osmPoint.lon}, geo_source='osm' where slug='${m.pharmacy.slug.replace(/'/g, "''")}' and latitude is null;`,
);

const sqlContent = `-- Géocodage des pharmacies par correspondance de nom avec OpenStreetMap.
-- Généré par scripts/geocode-pharmacies.mjs — NE PAS exécuter sans relecture.
-- ${matches.length} correspondance(s) sur ${pharmacies.length} pharmacie(s).
--
-- NOTE : la colonne "geo_source" n'existe pas encore dans le schéma actuel
-- (cf. src/integrations/supabase/types.ts). Si tu valides ces correspondances,
-- il faudra l'ajouter via une migration avant d'exécuter ce SQL (ou retirer
-- la colonne de cette requête).

${sqlLines.join("\n")}
`;

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT_FILE, sqlContent, "utf-8");

// ---------------------------------------------------------------------------
// Rapport
// ---------------------------------------------------------------------------

const unmatched = pharmacies.length - matches.length;

console.log();
console.log("=== RAPPORT DE GÉOCODAGE ===");
console.log(`Pharmacies de notre annuaire : ${pharmacies.length}`);
console.log(`Points OSM "amenity=pharmacy" avec nom : ${osmPoints.length}`);
console.log(`Correspondances trouvées : ${matches.length}`);
console.log(`Sans correspondance : ${unmatched}`);
console.log();
console.log(`Écrit dans ${OUTPUT_FILE}`);

console.log();
console.log("=== EXEMPLES (notre nom -> nom OSM, score) ===");
const samples = matches.slice(0, 10);
for (const m of samples) {
  console.log(`${m.pharmacy.nom}  ->  ${m.osmPoint.name}  (score=${m.score.toFixed(2)})`);
}
