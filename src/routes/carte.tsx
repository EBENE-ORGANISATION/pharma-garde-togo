import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useZone } from "@/lib/zone-store";
import { usePharmacies, useZones } from "@/lib/supabase-hooks";
import { useUserLocation, haversineKm, formatKm } from "@/lib/geo";

export const Route = createFileRoute("/carte")({
  component: CartePage,
});

function CartePage() {
  const { t, lang } = useLang();
  const { zone, setZone } = useZone();
  const { zones } = useZones();
  const { items: list } = usePharmacies(zone || null);
  const loc = useUserLocation();
  const withCoords = useMemo(
    () => list.filter((p) => p.latitude != null && p.longitude != null),
    [list],
  );
  const nearestId = useMemo(() => {
    if (!loc.coords) return null;
    let best: { id: string; km: number } | null = null;
    for (const p of withCoords) {
      const km = haversineKm(loc.coords, {
        lat: p.latitude as number,
        lon: p.longitude as number,
      });
      if (!best || km < best.km) best = { id: p.id, km };
    }
    return best?.id ?? null;
  }, [loc.coords, withCoords]);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (zones.length > 0 && (!zone || !zones.find((z) => z.id === zone))) {
      setZone(zones[0].id);
    }
  }, [zones, zone, setZone]);

  // init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined" || !containerRef.current) return;
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      (L.Marker.prototype as any).options.icon = icon;

      const map = L.map(containerRef.current).setView([8.6, 1.0], 6);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      if (layerRef.current) map.removeLayer(layerRef.current);
      const group = L.layerGroup();
      withCoords.forEach((p) => {
        const marker = L.marker([p.latitude as number, p.longitude as number]);
        marker.bindPopup(
          `<strong>${p.nom}</strong>${p.adresse ? `<br/>${p.adresse}` : ""}${p.telephone ? `<br/><a href="tel:${p.telephone}">${p.telephone}</a>` : ""}`,
        );
        marker.addTo(group);
      });
      group.addTo(map);
      layerRef.current = group;
      if (withCoords.length > 0) {
        const bounds = L.latLngBounds(
          withCoords.map((p) => [p.latitude as number, p.longitude as number] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    })();
  }, [ready, withCoords]);

  return (
    <AppShell title={t("map")}>
      <div className="px-4 pt-4">
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold"
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nom}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 px-4">
        <div
          ref={containerRef}
          className="h-[60vh] w-full overflow-hidden rounded-2xl border border-border bg-muted"
          aria-label={t("map")}
        >
          {!ready && (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              {t("loading_map")}
            </div>
          )}
        </div>
        {list.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">{t("no_pharmacies")}</p>
        )}
      </div>
    </AppShell>
  );
}
