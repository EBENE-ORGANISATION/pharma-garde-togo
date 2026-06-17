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
