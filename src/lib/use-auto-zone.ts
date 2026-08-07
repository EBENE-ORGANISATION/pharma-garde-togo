import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserLocation, haversineKm } from "@/lib/geo";
import { useZone } from "@/lib/zone-store";

type GeoPoint = { zone_id: string; lat: number; lng: number };

/**
 * Récupère (une fois) toutes les pharmacies géocodées : leur zone + coordonnées.
 * Sert à deviner la zone d'un utilisateur à partir de sa position GPS.
 */
function useGeoPoints(): GeoPoint[] {
  const [points, setPoints] = useState<GeoPoint[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("pharmacies")
          .select("zone_id, latitude, longitude")
          .not("latitude", "is", null)
          .not("zone_id", "is", null);
        if (cancelled || !data) return;
        setPoints(
          (data as Array<{ zone_id: string | null; latitude: number | null; longitude: number | null }>)
            .filter((r) => r.zone_id && r.latitude != null && r.longitude != null)
            .map((r) => ({
              zone_id: r.zone_id as string,
              lat: r.latitude as number,
              lng: r.longitude as number,
            })),
        );
      } catch {
        // hors-ligne : on ignore, la zone ne changera simplement pas automatiquement
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return points;
}

/**
 * Hook L1 — retourne une fonction `locate()`.
 * Au clic : demande la position GPS, puis dès qu'elle arrive, bascule sur la
 * zone de la pharmacie géocodée la plus proche (option 1 validée).
 * Ne change rien si aucune pharmacie n'est géocodée ou si on est hors-ligne.
 */
export function useAutoZone() {
  const points = useGeoPoints();
  const { zone, setZone } = useZone();
  const loc = useUserLocation();
  const pending = useRef(false);

  useEffect(() => {
    if (!pending.current || !loc.coords || points.length === 0) return;
    pending.current = false;

    let best: { km: number; zone_id: string } | null = null;
    for (const p of points) {
      const km = haversineKm(loc.coords, { lat: p.lat, lon: p.lng });
      if (!best || km < best.km) best = { km, zone_id: p.zone_id };
    }
    if (best && best.zone_id !== zone) setZone(best.zone_id);
  }, [loc.coords, points, zone, setZone]);

  return () => {
    pending.current = true;
    loc.request();
  };
}
