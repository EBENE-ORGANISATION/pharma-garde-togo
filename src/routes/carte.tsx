import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLang, ZONES } from "@/lib/i18n";
import { useZone } from "@/lib/zone-store";
import { PHARMACIES } from "@/lib/data";

export const Route = createFileRoute("/carte")({
  component: CartePage,
});

function CartePage() {
  const { t, lang } = useLang();
  const { zone, setZone } = useZone();
  const list = PHARMACIES.filter((p) => p.zone === zone);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // init
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined" || !containerRef.current) return;
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      // Default icon fix (use CDN)
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
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
      const group = L.layerGroup();
      const nearest = list[0];
      list.forEach((p) => {
        const isNearest = p.id === nearest?.id;
        const marker = L.marker([p.lat, p.lng]);
        marker.bindPopup(
          `<strong>${p.name}</strong><br/>${p.address}<br/><a href="tel:${p.phone}">${p.phone}</a>${isNearest ? `<br/><em>${t("nearest")}</em>` : ""}`,
        );
        if (isNearest) {
          L.circleMarker([p.lat, p.lng], {
            radius: 14,
            color: "#2f7355",
            fillColor: "#2f7355",
            fillOpacity: 0.25,
            weight: 2,
          }).addTo(group);
        }
        marker.addTo(group);
      });
      group.addTo(map);
      layerRef.current = group;

      if (list.length > 0) {
        const bounds = L.latLngBounds(list.map((p) => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    })();
  }, [ready, zone, lang, list, t]);

  return (
    <AppShell title={t("map")}>
      <div className="px-4 pt-4">
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold"
        >
          {ZONES.map((z) => (
            <option key={z.id} value={z.id}>
              {z[lang]}
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
        <p className="mt-2 text-xs text-muted-foreground">
          {t("nearest")}: {list[0]?.name ?? "—"}
        </p>
      </div>
    </AppShell>
  );
}
