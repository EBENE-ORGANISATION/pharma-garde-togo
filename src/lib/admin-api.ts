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
