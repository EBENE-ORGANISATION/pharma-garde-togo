import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  MapPin,
  Phone,
  Navigation,
  X,
  Clock,
  ChevronDown,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useZone } from "@/lib/zone-store";
import { usePharmacies, useAllPharmacies, useZones } from "@/lib/supabase-hooks";
import { useUserLocation, haversineKm, formatKm } from "@/lib/geo";
import { useModeOuverture } from "@/lib/horaires";
import type { Pharmacy } from "@/lib/db";
import { SignalerDialog } from "@/components/SignalerDialog";

export const Route = createFileRoute("/carte")({
  component: CartePage,
});

function directionsHref(p: Pharmacy): string | null {
  if (p.latitude == null || p.longitude == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=driving`;
}

function CartePage() {
  const { t, lang } = useLang();
  const { zone, setZone } = useZone();
  const { zones } = useZones();
  const { mode, libelle } = useModeOuverture();

  const { items: gardeList } = usePharmacies(zone || null);
  const { items: allList } = useAllPharmacies(mode === "jour" ? zone || null : null);
  const list = mode === "jour" ? allList : gardeList;

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
  const [selected, setSelected] = useState<Pharmacy | null>(null);
  const [zoneOpen, setZoneOpen] = useState(false);

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

      const [markerIcon, markerIcon2x, markerShadow] = await Promise.all([
        import("leaflet/dist/images/marker-icon.png"),
        import("leaflet/dist/images/marker-icon-2x.png"),
        import("leaflet/dist/images/marker-shadow.png"),
      ]);
      if (cancelled || !containerRef.current) return;

      const icon = L.icon({
        iconUrl: markerIcon.default,
        iconRetinaUrl: markerIcon2x.default,
        shadowUrl: markerShadow.default,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      (L.Marker.prototype as any).options.icon = icon;

      const map = L.map(containerRef.current, { zoomControl: false }).setView(
        [8.6, 1.0],
        6,
      );
      L.control.zoom({ position: "topright" }).addTo(map);
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
        const isNearest = p.id === nearestId;
        const color = isNearest ? "#16a34a" : "#2f7355";
        const size = isNearest ? 28 : 22;
        const html = `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);${isNearest ? "outline:3px solid rgba(34,197,94,.35);" : ""}"></div>`;
        const icon = L.divIcon({
          html,
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const marker = L.marker([p.latitude as number, p.longitude as number], { icon });
        marker.on("click", () => setSelected(p));
        marker.addTo(group);
      });

      if (loc.coords) {
        const userIcon = L.divIcon({
          html: `<div style="width:18px;height:18px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,.25);"></div>`,
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([loc.coords.lat, loc.coords.lon], { icon: userIcon }).addTo(group);
      }

      group.addTo(map);
      layerRef.current = group;

      const points: [number, number][] = withCoords.map(
        (p) => [p.latitude as number, p.longitude as number] as [number, number],
      );
      if (loc.coords) points.push([loc.coords.lat, loc.coords.lon]);
      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    })();
  }, [ready, withCoords, loc.coords, nearestId]);

  const currentZone = zones.find((z) => z.id === zone);
  const statusLabel = mode === "jour" ? t("status_open") : t("status_on_duty");

  const selectedKm =
    selected && loc.coords && selected.latitude != null && selected.longitude != null
      ? haversineKm(loc.coords, {
          lat: selected.latitude as number,
          lon: selected.longitude as number,
        })
      : null;

  return (
    <AppShell title={t("map")}>
      {/* Green header band with zone selector */}
      <section className="rounded-b-[28px] bg-primary px-4 pt-5 pb-6 text-primary-foreground shadow-soft">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-primary">
            <MapPin className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight">{t("map")}</h1>
            <p className="truncate text-xs font-medium text-primary-foreground/85">
              {libelle}
            </p>
          </div>
        </div>

        <div className="relative mt-4">
          <button
            type="button"
            onClick={() => setZoneOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 text-left text-foreground shadow-card active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <MapPin className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate text-base font-bold text-primary-dark">
                {currentZone ? currentZone.nom : "—"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
              {t("change_zone")}
              <ChevronDown
                className={"h-4 w-4 transition-transform " + (zoneOpen ? "rotate-180" : "")}
              />
            </span>
          </button>
          {zoneOpen && (
            <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
              {zones.map((z) => {
                const active = z.id === zone;
                return (
                  <button
                    key={z.id}
                    onClick={() => {
                      setZone(z.id);
                      setZoneOpen(false);
                    }}
                    className={
                      "flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold " +
                      (active
                        ? "bg-primary-soft text-primary-dark"
                        : "text-foreground hover:bg-primary-soft/60")
                    }
                  >
                    <span>{z.nom}</span>
                    {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Legend */}
      <section className="px-4 pt-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-card px-4 py-3 text-xs font-semibold text-primary-dark shadow-card">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-primary ring-2 ring-white" />
            {statusLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-green-600 ring-2 ring-white outline outline-2 outline-green-300/60" />
            {t("nearest")}
          </span>
          {loc.coords && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-blue-600 ring-2 ring-white" />
              {t("legend_you")}
            </span>
          )}
        </div>
      </section>

      {/* Map + floating actions */}
      <section className="relative mt-3 px-4">
        <div
          ref={containerRef}
          className="h-[62vh] w-full overflow-hidden rounded-[24px] border border-border bg-muted shadow-card"
          aria-label={t("map")}
        >
          {!ready && (
            <div className="grid h-full place-items-center text-sm font-semibold text-muted-foreground">
              {t("loading_map")}
            </div>
          )}
        </div>

        {/* Floating "My location" button */}
        <button
          type="button"
          onClick={loc.request}
          disabled={loc.status === "loading"}
          aria-label={t("my_location")}
          className="absolute bottom-4 right-7 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft active:scale-95 disabled:opacity-60"
        >
          <Crosshair className={"h-6 w-6 " + (loc.status === "loading" ? "animate-spin" : "")} />
        </button>

        {list.length === 0 && (
          <p className="mt-3 rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-xs font-semibold text-muted-foreground">
            {t("no_pharmacies")}
          </p>
        )}
        {(loc.status === "denied" || loc.status === "unavailable") && (
          <p className="mt-2 text-xs text-muted-foreground">{t("location_unavailable")}</p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">{t("tap_marker_hint")}</p>
      </section>

      {/* Bottom sheet for selected pharmacy */}
      {selected && (
        <>
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[28px] border-t border-border bg-card p-5 shadow-soft"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-primary-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                {statusLabel}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={t("close")}
                className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary-dark active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="mt-3 text-xl font-extrabold leading-tight text-primary-dark">
              {selected.nom}
            </h3>
            {selected.adresse && (
              <p className="mt-1 text-sm leading-snug text-muted-foreground">
                {selected.adresse}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {selectedKm != null && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">
                    {formatKm(selectedKm, lang)}
                  </span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-dark">
                <Clock className="h-3.5 w-3.5" />
                {libelle}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                href={selected.telephone ? `tel:${selected.telephone}` : "#"}
                aria-disabled={!selected.telephone}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground shadow-soft active:scale-[0.97] disabled:opacity-60"
              >
                <Phone className="h-5 w-5" /> {t("call")}
              </a>
              <DirectionsButton p={selected} label={t("directions")} />
            </div>
            <div className="mt-3 flex justify-center"><SignalerDialog pharmacie={selected} /></div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function DirectionsButton({ p, label }: { p: Pharmacy; label: string }) {
  const href = directionsHref(p);
  const cls =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-base font-bold text-primary-dark active:scale-[0.97]";
  if (!href) {
    return (
      <button type="button" disabled className={cls + " opacity-50"}>
        <Navigation className="h-5 w-5" /> {label}
      </button>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      <Navigation className="h-5 w-5" /> {label}
    </a>
  );
}
