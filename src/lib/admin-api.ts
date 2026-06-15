import { supabase } from "@/integrations/supabase/client";

// `is_admin` and `publier_zone` are SQL functions added by
// supabase/migrations/phase3_admin.sql. The generated `Database` types
// don't know about them yet (types.ts is regenerated from the live schema),
// so we type the `rpc` calls manually here.
type RpcFn = <Name extends string, Args extends Record<string, unknown> | undefined>(
  fn: Name,
  args?: Args,
) => Promise<{ data: unknown; error: { message: string } | null }>;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcFn;

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await rpc("is_admin");
  if (error) return false;
  return Boolean(data);
}

export async function publishZone(zoneId: string) {
  return rpc("publier_zone", { p_zone_id: zoneId });
}
