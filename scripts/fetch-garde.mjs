// Récupère le planning de garde de la semaine courante depuis l'API de l'Ordre,
// l'associe à notre annuaire local, et génère un SQL prêt à valider.
//
// Sortie :  scripts/output/garde-semaine.sql
// Rapport : console
//
// NE touche PAS à la base, n'exécute AUCUN SQL, ne committe rien.
// Usage :   node scripts/fetch-garde.mjs

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const ANNUAIRE_FILE = path.resolve("scripts/output/pharmacies_togo.json");
const OUTPUT_DIR    = path.resolve("scripts/output");
const OUTPUT_FILE   = path.join(OUTPUT_DIR, "garde-semaine.sql");

// ---------------------------------------------------------------------------
// 1. Date du jour
// ---------------------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// ---------------------------------------------------------------------------
// 2. Appel API de l'Ordre
// ---------------------------------------------------------------------------
const apiUrl =
  `https://www.pharmaciens.tg/api/pharmacies-de-gardes` +
  `?populate[pharmacies][populate][pharmacie][populate][adresse]=true` +
  `&populate[pharmacies][populate][pharmacie][populate][zone]=true` +
  `&pagination[page]=1&pagination[pageSize]=500` +
  `&filters[a][$gte]=${today}` +
  `&filters[de][$lte]=${today}`;

console.log(`Interrogation de l'API de garde pour la date ${today} …`);
const resp = await fetch(apiUrl, {
  headers: { "User-Agent": "pharma-garde-togo-fetch-garde/1.0" },
});
if (!resp.ok) throw new Error(`API a répondu ${resp.status} ${resp.statusText}`);
const json = await resp.json();

// L'API retourne un tableau de "semaines de garde".
// On prend la première (celle dont les dates encadrent aujourd'hui).
const semaines = (json.data || []);
if (semaines.length === 0) {
  console.log("⚠ Aucun planning de garde trouvé pour cette date. Arrêt.");
  process.exit(0);
}
const semaine      = semaines[0];
const dateDebut    = semaine.de;    // YYYY-MM-DD
const dateFin      = semaine.a;     // YYYY-MM-DD
const titreWeek    = semaine.titre;
const gardeItems   = semaine.pharmacies || [];

// Chaque item : { pharmacie: { slug, titre, adresse: { telephone }, zone: { titre } } }
const apiPharms = gardeItems
  .map((item) => item.pharmacie)
  .filter(Boolean)
  .map((p) => ({
    apiSlug   : p.slug  || "",
    nom       : (p.titre || "").replace(/\s+/g, " ").trim(),
    telephone : p.adresse?.telephone || null,
    zoneTitre : p.zone?.titre || null,
  }));

// ---------------------------------------------------------------------------
// 3. Chargement de notre annuaire + normalisation (mêmes fonctions que les
//    scripts existants)
// ---------------------------------------------------------------------------
const raw      = await readFile(ANNUAIRE_FILE, "utf-8");
const annuaire = JSON.parse(raw);

// Slug : lu directement depuis le JSON, comme dans generate-sql.mjs
// Nom  : p.titre nettoyé, comme dans generate-sql.mjs
const nos = annuaire
  .filter((p) => p.slug && p.titre)
  .map((p) => ({
    slug : p.slug,
    nom  : (p.titre || "").replace(/\s+/g, " ").trim(),
  }));

// Normalisation identique à geocode-pharmacies.mjs
const GENERIC = /\b(pharmacie|pharmacy|phie|phcie)\b/g;

function normalizeName(raw) {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip accents (U+0300–U+036F)
    .replace(GENERIC, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Index pour recherche rapide
const bySlug = new Map(nos.map((p) => [p.slug, p]));
const byNorm = new Map(nos.map((p) => [normalizeName(p.nom), p]));

// ---------------------------------------------------------------------------
// 4. Association
// ---------------------------------------------------------------------------
const matchedBySlug = [];
const matchedByNom  = [];
const notFound      = [];

for (const ap of apiPharms) {
  // Passe 1 : slug exact
  const m1 = bySlug.get(ap.apiSlug);
  if (m1) {
    matchedBySlug.push({ api: ap, local: m1 });
    continue;
  }
  // Passe 2 : nom normalisé exact
  const m2 = byNorm.get(normalizeName(ap.nom));
  if (m2) {
    matchedByNom.push({ api: ap, local: m2 });
    continue;
  }
  notFound.push(ap);
}

const allMatched = [...matchedBySlug, ...matchedByNom];

// ---------------------------------------------------------------------------
// 5. Répartition par zone (titrée côté API)
// ---------------------------------------------------------------------------
const byZone = new Map();
for (const { api } of allMatched) {
  const z = api.zoneTitre || "Inconnue";
  byZone.set(z, (byZone.get(z) || 0) + 1);
}

// ---------------------------------------------------------------------------
// 6. Génération du SQL
//
// Format copié EXACTEMENT de PlanningTab.tsx / types.ts :
//   colonnes : pharmacie_id, zone_id, date_debut, date_fin, statut, source
//   pharmacie_id et zone_id sont des UUID → on utilise des sous-requêtes
//   pour éviter d'avoir besoin d'accéder à la base ici.
//
// DELETE idempotent : uniquement les brouillons importés via l'API
//   (source = 'api-onpt') pour ces dates précises, afin de ne pas écraser
//   des entrées publiées ou saisies manuellement dans l'admin.
// ---------------------------------------------------------------------------

function sqlLit(v) {
  if (v == null) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

const insertLines = allMatched.map(({ local }) => {
  // Les UUID de pharmacie_id et zone_id viennent de NOTRE table pharmacies
  // (la zone déjà assignée dans notre annuaire, pas celle de l'API).
  return (
    `insert into public.planning_garde ` +
    `  (pharmacie_id, zone_id, date_debut, date_fin, statut, source)\n` +
    `select\n` +
    `  p.id,\n` +
    `  p.zone_id,\n` +
    `  ${sqlLit(dateDebut)},\n` +
    `  ${sqlLit(dateFin)},\n` +
    `  'brouillon',\n` +
    `  'api-onpt'\n` +
    `from public.pharmacies p\n` +
    `where p.slug = ${sqlLit(local.slug)};`
  );
});

const sqlContent =
`-- Planning de garde importé depuis l'API de l'Ordre National des Pharmaciens du Togo.
-- Semaine : ${titreWeek}
-- Période : ${dateDebut} → ${dateFin}
-- ${allMatched.length} pharmacie(s) associée(s) à notre annuaire.
-- Source des données : ${apiUrl}
--
-- ⚠ À RELIRE AVANT EXÉCUTION — ne pas exécuter sans validation.
-- Statut inséré : 'brouillon' (utilisable via l'admin pour publication).
-- Pour publier une zone, utiliser le bouton "Publier la semaine" dans /admin.
--
-- DELETE idempotent : supprime uniquement les brouillons API (source='api-onpt')
-- pour ces dates précises. N'efface pas les entrées publiées ni les saisies admin.

delete from public.planning_garde
where date_debut = ${sqlLit(dateDebut)}
  and date_fin   = ${sqlLit(dateFin)}
  and source     = 'api-onpt'
  and statut     = 'brouillon';

${insertLines.join("\n\n")}
`;

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT_FILE, sqlContent, "utf-8");

// ---------------------------------------------------------------------------
// 7. Rapport console
// ---------------------------------------------------------------------------
console.log();
console.log("=== PLANNING DE GARDE — RAPPORT ===");
console.log(`Semaine : ${titreWeek}`);
console.log(`Période : ${dateDebut} → ${dateFin}`);
console.log();
console.log(`Pharmacies renvoyées par l'API          : ${apiPharms.length}`);
console.log(`Associées par slug                      : ${matchedBySlug.length}`);
console.log(`Associées par nom normalisé             : ${matchedByNom.length}`);
console.log(`Non retrouvées dans notre annuaire      : ${notFound.length}`);
console.log();

if (notFound.length > 0) {
  console.log("--- Pharmacies non retrouvées ---");
  for (const p of notFound) {
    console.log(`  • ${p.nom}  [slug API: ${p.apiSlug}]  [zone: ${p.zoneTitre || "?"}]`);
  }
  console.log();
}

console.log("--- Répartition par zone (API) ---");
for (const [zone, count] of [...byZone.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(3)}  ${zone}`);
}

console.log();
console.log(`Fichier SQL écrit : ${OUTPUT_FILE}`);
