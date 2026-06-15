import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getDb,
  type Zone,
  type Pharmacy,
  type Emergency,
  type Medicine,
  type ZoneSnapshot,
} from "@/lib/db";

export type { Zone, Pharmacy, Emergency, Medicine };

const byNom = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom);
const byOrdre = (a: { ordre: number }, b: { ordre: number }) => a.ordre - b.ordre;

export function useZones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const db = getDb();
    (async () => {
      // 1. cache-first: show whatever we have locally instantly
      if (db) {
        try {
          const cached = await db.zones.toArray();
          if (!cancelled && cached.length > 0) {
            setZones([...cached].sort(byNom));
            setLoading(false);
          }
        } catch {
          // ignore cache read errors
        }
      }

      // 2. refresh from network if available
      try {
        const { data, error } = await supabase
          .from("zones")
          .select("id, nom, slug, region")
          .eq("actif", true)
          .order("nom", { ascending: true });
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          const fresh = (data ?? []) as Zone[];
          setZones(fresh);
          if (db) {
            await db.transaction("rw", db.zones, async () => {
              await db.zones.clear();
              await db.zones.bulkPut(fresh);
            });
          }
        }
      } catch {
        // offline: keep cached data (already set above) if any
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { zones, loading, error };
}

export function useEmergencies(zoneId: string | null) {
  const [items, setItems] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const db = getDb();
    const matches = (e: Emergency) =>
      zoneId ? e.zone_id === null || e.zone_id === zoneId : e.zone_id === null;

    (async () => {
      // 1. cache-first
      if (db) {
        try {
          const cached = (await db.emergencies.toArray()).filter(matches).sort(byOrdre);
          if (!cancelled && cached.length > 0) {
            setItems(cached);
            setLoading(false);
          }
        } catch {
          // ignore cache read errors
        }
      }

      // 2. zone snapshot (published by publier_zone), if available
      if (zoneId) {
        try {
          const { data: snap } = await supabase
            .from("snapshots")
            .select("zone_id, version, semaine, published_at, data")
            .eq("zone_id", zoneId)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (cancelled) return;
          const snapEmergencies = (snap?.data as { numeros_urgence?: Emergency[] } | null)
            ?.numeros_urgence;
          if (snap && Array.isArray(snapEmergencies)) {
            const fresh = [...snapEmergencies].sort(byOrdre);
            setItems(fresh);
            if (db && fresh.length > 0) await db.emergencies.bulkPut(fresh);
            setLoading(false);
            return;
          }
        } catch {
          // snapshots unreachable: fall through to raw table
        }
      }

      // 3. fallback: raw table query
      try {
        let query = supabase
          .from("numeros_urgence")
          .select("id, libelle, numero, ordre, zone_id")
          .eq("actif", true)
          .order("ordre", { ascending: true });
        query = zoneId
          ? query.or(`zone_id.is.null,zone_id.eq.${zoneId}`)
          : query.is("zone_id", null);
        const { data } = await query;
        if (cancelled) return;
        const fresh = (data ?? []) as Emergency[];
        setItems(fresh);
        if (db && fresh.length > 0) await db.emergencies.bulkPut(fresh);
      } catch {
        // offline: keep cached items already shown
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zoneId]);
  return { items, loading };
}

export function usePharmacies(zoneId: string | null) {
  const [items, setItems] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const db = getDb();
    if (!zoneId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      // 1. cache-first
      if (db) {
        try {
          const cached = await db.pharmacies.where("zone_id").equals(zoneId).toArray();
          if (!cancelled && cached.length > 0) {
            setItems([...cached].sort(byNom));
            setLoading(false);
          }
        } catch {
          // ignore cache read errors
        }
      }

      // 2. zone snapshot (published by publier_zone), if available
      try {
        const { data: snap } = await supabase
          .from("snapshots")
          .select("zone_id, version, semaine, published_at, data")
          .eq("zone_id", zoneId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        const snapPharmacies = (snap?.data as { pharmacies?: Pharmacy[] } | null)?.pharmacies;
        if (snap && Array.isArray(snapPharmacies)) {
          const fresh = [...snapPharmacies].sort(byNom);
          setItems(fresh);
          if (db) {
            await db.transaction("rw", db.pharmacies, db.snapshots, async () => {
              await db.pharmacies.where("zone_id").equals(zoneId).delete();
              await db.pharmacies.bulkPut(fresh);
              await db.snapshots.put({
                zone_id: zoneId,
                version: snap.version,
                semaine: snap.semaine,
                published_at: snap.published_at,
                data: snap.data as ZoneSnapshot["data"],
                cached_at: Date.now(),
              });
            });
          }
          setLoading(false);
          return;
        }
      } catch {
        // snapshots unreachable: fall through to raw table
      }

      // 3. fallback: raw table query
      try {
        const { data } = await supabase
          .from("pharmacies")
          .select("id, nom, adresse, telephone, latitude, longitude, zone_id")
          .eq("actif", true)
          .eq("zone_id", zoneId)
          .order("nom", { ascending: true });
        if (cancelled) return;
        const fresh = (data ?? []) as Pharmacy[];
        setItems(fresh);
        if (db) {
          await db.transaction("rw", db.pharmacies, async () => {
            await db.pharmacies.where("zone_id").equals(zoneId).delete();
            await db.pharmacies.bulkPut(fresh);
          });
        }
      } catch {
        // offline: keep cached items already shown
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zoneId]);
  return { items, loading };
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function matchesTerm(m: Medicine, normalizedTerm: string) {
  const hay = [m.dci, m.forme, m.dosage]
    .filter(Boolean)
    .map((x) => normalize(x as string))
    .join(" ");
  return hay.includes(normalizedTerm);
}

const MEDICAMENTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function useMedicineSearch(q: string) {
  const term = useMemo(() => q.trim(), [q]);
  const [items, setItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);

  // Best-effort background sync of the full medicaments list, so search
  // keeps working offline. Runs at most once a day.
  useEffect(() => {
    const db = getDb();
    if (!db) return;
    (async () => {
      try {
        const meta = await db.meta.get("medicaments_synced_at");
        const stale = !meta || Date.now() - meta.updated_at > MEDICAMENTS_CACHE_TTL_MS;
        if (!stale) return;
        const { data, error } = await supabase
          .from("medicaments")
          .select("id, nom_commercial, dci, forme, dosage")
          .order("dci", { ascending: true });
        if (error || !data) return;
        await db.transaction("rw", db.medicaments, db.meta, async () => {
          await db.medicaments.clear();
          await db.medicaments.bulkPut(data as Medicine[]);
          await db.meta.put({ key: "medicaments_synced_at", value: true, updated_at: Date.now() });
        });
      } catch {
        // offline: skip, will retry on next mount
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!term) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getDb();
    const n = normalize(term);

    // 1. instant local results from cache
    (async () => {
      if (!db) return;
      try {
        const local = (await db.medicaments.toArray())
          .filter((m) => matchesTerm(m, n))
          .sort((a, b) => a.dci.localeCompare(b.dci))
          .slice(0, 50);
        if (!cancelled && local.length > 0) {
          setItems(local);
          setLoading(false);
        }
      } catch {
        // ignore cache read errors
      }
    })();

    const handle = setTimeout(async () => {
      try {
        const like = `%${term}%`;
        const { data } = await supabase
          .from("medicaments")
          .select("id, nom_commercial, dci, forme, dosage")
          .or(`dci.ilike.${like},forme.ilike.${like},dosage.ilike.${like}`)
          .order("dci", { ascending: true })
          .limit(50);
        if (cancelled) return;
        // client-side accent-insensitive refinement
        const filtered = ((data ?? []) as Medicine[]).filter((m) => matchesTerm(m, n));
        setItems(filtered);
        if (db && filtered.length > 0) await db.medicaments.bulkPut(filtered);
      } catch {
        // offline: keep local cache results already shown (if any)
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [term]);
  return { items, loading };
}
