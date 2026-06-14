import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Phone, MapPin, Crosshair } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useZone } from "@/lib/zone-store";
import { usePharmacies, useZones } from "@/lib/supabase-hooks";
import { useUserLocation, haversineKm, formatKm } from "@/lib/geo";

export const Route = createFileRoute("/garde")({
  component: GardePage,
});

function GardePage() {
  const { t, lang } = useLang();
  const { zone, setZone } = useZone();
  const { zones } = useZones();
  const { items: list, loading } = usePharmacies(zone || null);
  const loc = useUserLocation();

  const sorted = useMemo(() => {
    if (!loc.coords) return list;
    return [...list].sort((a, b) => {
      const da =
        a.latitude != null && a.longitude != null
          ? haversineKm(loc.coords!, { lat: a.latitude, lon: a.longitude })
          : Infinity;
      const db =
        b.latitude != null && b.longitude != null
          ? haversineKm(loc.coords!, { lat: b.latitude, lon: b.longitude })
          : Infinity;
      return da - db;
    });
  }, [list, loc.coords]);

  useEffect(() => {
    if (zones.length > 0 && (!zone || !zones.find((z) => z.id === zone))) {
      setZone(zones[0].id);
    }
  }, [zones, zone, setZone]);

  const zoneLabel = zones.find((z) => z.id === zone)?.nom ?? "";

  return (
    <AppShell title={t("on_duty")}>
      <div className="px-4 pt-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("zone")}
        </label>
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold"
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nom}
            </option>
          ))}
        </select>

        <h2 className="mt-5 text-lg font-bold">
          {t("pharmacies_in")} {zoneLabel}
        </h2>
      </div>

      <ul className="mt-3 space-y-3 px-4 pb-4">
        {list.map((p) => (
          <li key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold">{p.nom}</h3>
                {p.adresse && <p className="mt-1 text-sm text-muted-foreground">{p.adresse}</p>}
                {p.telephone && <p className="mt-1 text-sm font-mono">{p.telephone}</p>}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={p.telephone ? `tel:${p.telephone}` : "#"}
                aria-disabled={!p.telephone}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground active:scale-[0.98]"
              >
                <Phone className="h-4 w-4" /> {t("call")}
              </a>
              <Link
                to="/carte"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold"
              >
                <MapPin className="h-4 w-4" /> {t("see_on_map")}
              </Link>
            </div>
          </li>
        ))}
        {!loading && list.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("no_pharmacies")}
          </li>
        )}
      </ul>
    </AppShell>
  );
}
