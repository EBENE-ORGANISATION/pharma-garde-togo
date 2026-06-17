import { supabase } from "@/integrations/supabase/client";

// `is_admin` and `publier_zone` are SQL functions added by
// supabase/migrations/phase3_admin.sql.

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false;
  return Boolean(data);
}

export async function publishZone(zoneId: string) {
  return supabase.rpc("publier_zone", { p_zone_id: zoneId });
}

// ---- Géocodage ----

export type PharmacieGeo = {
  id: string;
  slug: string | null;
  nom: string;
  adresse: string | null;
  zone_id: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ZoneAdmin = {
  id: string;
  slug: string;
  nom: string;
};

export async function listPharmaciesSansGps() {
  return supabase
    .from("pharmacies")
    .select("id, slug, nom, adresse, zone_id, latitude, longitude")
    .is("latitude", null)
    .order("nom", { ascending: true });
}

export async function rechercherPharmacie(terme: string) {
  return supabase
    .from("pharmacies")
    .select("id, slug, nom, adresse, zone_id, latitude, longitude")
    .ilike("nom", `%${terme}%`)
    .order("nom", { ascending: true })
    .limit(30);
}

export async function listZones() {
  return supabase
    .from("zones")
    .select("id, slug, nom")
    .order("nom", { ascending: true });
}

export async function majCoordsPharmacie(
  id: string,
  latitude: number,
  longitude: number,
  zoneId?: string | null,
) {
  return supabase
    .from("pharmacies")
    .update({
      latitude,
      longitude,
      geo_source: "manuel",
      ...(zoneId != null ? { zone_id: zoneId } : {}),
    })
    .eq("id", id);
}

// ---- Jours fériés ----

export type JourFerie = {
  id: string;
  date: string;        // YYYY-MM-DD
  nom: string;
  a_confirmer: boolean;
};

export async function listJoursFeries() {
  return supabase
    .from("jours_feries")
    .select("id, date, nom, a_confirmer")
    .order("date", { ascending: true });
}

export async function addJourFerie(date: string, nom: string, a_confirmer: boolean) {
  return supabase
    .from("jours_feries")
    .insert({ date, nom, a_confirmer });
}

export async function updateJourFerie(
  id: string,
  data: Partial<Pick<JourFerie, "date" | "nom" | "a_confirmer">>,
) {
  return supabase.from("jours_feries").update(data).eq("id", id);
}

export async function deleteJourFerie(id: string) {
  return supabase.from("jours_feries").delete().eq("id", id);
}
