import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function useZones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("zones")
        .select("id, nom, slug, region")
        .eq("actif", true)
        .order("nom", { ascending: true });
      if (cancelled) return;
      if (error) setError(error.message);
      else setZones((data ?? []) as Zone[]);
      setLoading(false);
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
    (async () => {
      setLoading(true);
      let query = supabase
        .from("numeros_urgence")
        .select("id, libelle, numero, ordre, zone_id")
        .eq("actif", true)
        .order("ordre", { ascending: true });
      if (zoneId) {
        query = query.or(`zone_id.is.null,zone_id.eq.${zoneId}`);
      } else {
        query = query.is("zone_id", null);
      }
      const { data } = await query;
      if (cancelled) return;
      setItems((data ?? []) as Emergency[]);
      setLoading(false);
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
    if (!zoneId) {
      setItems([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("pharmacies")
        .select("id, nom, adresse, telephone, latitude, longitude, zone_id")
        .eq("actif", true)
        .eq("zone_id", zoneId)
        .order("nom", { ascending: true });
      if (cancelled) return;
      setItems((data ?? []) as Pharmacy[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [zoneId]);
  return { items, loading };
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function useMedicineSearch(q: string) {
  const term = useMemo(() => q.trim(), [q]);
  const [items, setItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!term) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const like = `%${term}%`;
      const { data } = await supabase
        .from("medicaments")
        .select("id, nom_commercial, dci, forme, dosage")
        .or(`dci.ilike.${like},forme.ilike.${like},dosage.ilike.${like}`)
        .order("dci", { ascending: true })
        .limit(50);
      if (cancelled) return;
      // client-side accent-insensitive refinement
      const n = normalize(term);
      const filtered = (data ?? []).filter((m: any) => {
        const hay = [m.dci, m.forme, m.dosage].filter(Boolean).map((x: string) => normalize(x)).join(" ");
        return hay.includes(n);
      });
      setItems(filtered as Medicine[]);
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [term]);
  return { items, loading };
}
