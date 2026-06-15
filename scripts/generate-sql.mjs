import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const INPUT_FILE = path.resolve("scripts/output/pharmacies_togo.json");
const OUTPUT_DIR = path.resolve("scripts/output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "pharmacies_upsert.sql");

const CITY_TO_ZONE_SLUG = {
  KARA: "kara",
  KPALIME: "plateaux",
  ATAKPAME: "plateaux",
  SOKODE: "centrale",
  ANEHO: "maritime",
  TSEVIE: "maritime",
  ANFOIN: "maritime",
  DAPAONG: "savanes",
};

function mapZoneSlug(zoneTitre) {
  if (!zoneTitre) return null;
  const normalized = zoneTitre.toUpperCase().trim();
  if (normalized.length === 0) return null;
  if (CITY_TO_ZONE_SLUG[normalized]) return CITY_TO_ZONE_SLUG[normalized];
  return "grand-lome";
}

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  const escaped = String(value).replace(/'/g, "''");
  return `'${escaped}'`;
}

function sqlZoneIdSubquery(zoneSlug) {
  if (!zoneSlug) return "NULL";
  return `(select id from public.zones where slug = ${sqlString(zoneSlug)})`;
}

const raw = await readFile(INPUT_FILE, "utf-8");
const data = JSON.parse(raw);

const zoneCounts = new Map();
const rows = [];

for (const p of data) {
  const nom = (p.titre || "").replace(/\s+/g, " ").trim();
  const adresseRaw = p.adresse && p.adresse.adresse ? p.adresse.adresse.trim() : null;
  const adresse = adresseRaw && adresseRaw.length > 0 ? adresseRaw : null;
  const telephone = p.adresse && p.adresse.telephone ? p.adresse.telephone : null;
  const slug = p.slug;
  const zoneTitre = p.zone ? p.zone.titre : null;
  const zoneSlug = mapZoneSlug(zoneTitre);

  zoneCounts.set(zoneSlug, (zoneCounts.get(zoneSlug) || 0) + 1);

  rows.push(
    `(${sqlString(nom)}, ${sqlString(adresse)}, ${sqlString(telephone)}, NULL, NULL, true, ${sqlString(slug)}, ${sqlZoneIdSubquery(zoneSlug)})`
  );
}

const sql = `-- Supprime les pharmacies de test sans slug
delete from public.pharmacies where slug is null;

-- Upsert idempotent des 278 pharmacies (clé de conflit : slug)
insert into public.pharmacies (nom, adresse, telephone, latitude, longitude, actif, slug, zone_id) values
${rows.join(",\n")}
on conflict (slug) do update set
  nom = excluded.nom,
  adresse = excluded.adresse,
  telephone = excluded.telephone,
  zone_id = excluded.zone_id,
  actif = excluded.actif;
`;

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT_FILE, sql, "utf-8");

console.log("=== COMPTE PAR ZONE MAPPÉE ===");
for (const [zone, count] of [...zoneCounts.entries()].sort((a, b) => (b[1] - a[1]))) {
  console.log(`${count}  ${zone === null ? "NULL" : zone}`);
}

console.log();
console.log(`Écrit dans ${OUTPUT_FILE}`);
console.log();
console.log("=== 5 PREMIÈRES LIGNES DU SQL GÉNÉRÉ ===");
const lines = sql.split("\n");
console.log(lines.slice(0, 8).join("\n"));
