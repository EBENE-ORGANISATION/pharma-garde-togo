import Dexie, { type Table } from "dexie";

export type Zone = { id: string; nom: string; slug: string; region: string | null };
export type Pharmacy = {
  id: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  latitude: number | null;
  longitude: number | null;
  zone_id: string | null;
};
export type Emergency = {
  id: string;
  libelle: string;
  numero: string;
  ordre: number;
  zone_id: string | null;
};
export type Medicine = {
  id: string;
  nom_commercial: string | null;
  dci: string;
  forme: string | null;
  dosage: string | null;
};

// Local copy of a published zone snapshot (table `snapshots`).
// `data` follows the contract produced by the future `publier_zone()` function:
// { zone?, pharmacies?, numeros_urgence?, generated_at? }
export type ZoneSnapshot = {
  zone_id: string;
  version: number;
  semaine: string | null;
  published_at: string;
  data: {
    zone?: Zone;
    pharmacies?: Pharmacy[];
    numeros_urgence?: Emergency[];
    generated_at?: string;
  };
  cached_at: number;
};

export type MetaEntry = { key: string; value: unknown; updated_at: number };

class PharmaGardeDB extends Dexie {
  zones!: Table<Zone, string>;
  pharmacies!: Table<Pharmacy, string>;
  emergencies!: Table<Emergency, string>;
  medicaments!: Table<Medicine, string>;
  snapshots!: Table<ZoneSnapshot, string>;
  annuaire!: Table<Pharmacy, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super("pharmagarde");
    this.version(1).stores({
      zones: "id",
      pharmacies: "id, zone_id",
      emergencies: "id, zone_id",
      medicaments: "id, dci",
      snapshots: "zone_id",
      meta: "key",
    });
    this.version(2).stores({
      annuaire: "id, zone_id",
    });
  }
}

let _db: PharmaGardeDB | null = null;

// Lazily create the Dexie database. Returns null outside the browser (SSR)
// since IndexedDB is not available there.
export function getDb(): PharmaGardeDB | null {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return null;
  if (!_db) _db = new PharmaGardeDB();
  return _db;
}
