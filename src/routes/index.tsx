import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Pill, MapPin, Phone, Search, ChevronRight, Crosshair } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useZone } from "@/lib/zone-store";
import { useZones, usePharmacies } from "@/lib/supabase-hooks";
import { useUserLocation, haversineKm, formatKm } from "@/lib/geo";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { t, lang } = useLang();
  const { zone, setZone } = useZone();
  const { zones, loading } = useZones();
  const { items: pharmacies } = usePharmacies(zone || null);
  const loc = useUserLocation();

  const nearest = useMemo(() => {
    if (!loc.coords) return null;
    const withCoords = pharmacies.filter(
      (p) => p.latitude != null && p.longitude != null,
    );
    if (withCoords.length === 0) return null;
    let best: { p: (typeof withCoords)[number]; km: number } | null = null;
    for (const p of withCoords) {
      const km = haversineKm(loc.coords, {
        lat: p.latitude as number,
        lon: p.longitude as number,
      });
      if (!best || km < best.km) best = { p, km };
    }
    return best;
  }, [loc.coords, pharmacies]);

  // auto-select first zone once loaded if none selected or stored id no longer exists
  useEffect(() => {
    if (loading || zones.length === 0) return;
    if (!zone || !zones.find((z) => z.id === zone)) {
      setZone(zones[0].id);
    }
  }, [loading, zones, zone, setZone]);

  const tiles = [
    { to: "/garde", label: t("on_duty"), icon: Pill, tone: "primary" as const },
    { to: "/carte", label: t("map"), icon: MapPin, tone: "soft" as const },
    { to: "/urgences", label: t("emergency_numbers"), icon: Phone, tone: "emergency" as const },
    { to: "/medicaments", label: t("medicines"), icon: Search, tone: "soft" as const },
  ];

  return (
    <AppShell>
      <section className="bg-primary-soft px-4 pt-6 pb-8">
        <h1 className="text-2xl font-extrabold leading-tight text-primary-dark">{t("tagline")}</h1>
        <p className="mt-1 text-sm text-primary-dark/70">{t("app_name")}</p>

        <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-primary-dark/80">
          {t("select_zone")}
        </label>
        {loading ? (
          <div className="mt-2 text-sm text-primary-dark/70">…</div>
        ) : zones.length === 0 ? (
          <div className="mt-2 text-sm text-primary-dark/70">—</div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {zones.map((z) => {
              const active = z.id === zone;
              return (
                <button
                  key={z.id}
                  onClick={() => setZone(z.id)}
                  className={
                    "rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground shadow-soft"
                      : "border-border bg-background text-foreground hover:border-primary/40")
                  }
                >
                  {z.nom}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="px-4 pt-5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {t("nearest_pharmacy")}
            </h2>
          </div>

          {!loc.coords && (
            <>
              <button
                onClick={loc.request}
                disabled={loc.status === "loading"}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
              >
                <Crosshair className="h-4 w-4" />
                {loc.status === "loading" ? t("locating") : t("use_my_location")}
              </button>
              {(loc.status === "denied" || loc.status === "unavailable") && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("location_unavailable")}
                </p>
              )}
            </>
          )}

          {loc.coords && nearest && (
            <div className="mt-3">
              <h3 className="text-base font-bold">{nearest.p.nom}</h3>
              <p className="mt-0.5 text-sm font-semibold text-primary">
                {formatKm(nearest.km, lang)}
              </p>
              {nearest.p.adresse && (
                <p className="mt-1 text-sm text-muted-foreground">{nearest.p.adresse}</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("as_the_crow_flies")}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={nearest.p.telephone ? `tel:${nearest.p.telephone}` : "#"}
                  aria-disabled={!nearest.p.telephone}
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
            </div>
          )}

          {loc.coords && !nearest && (
            <p className="mt-3 text-sm text-muted-foreground">{t("no_pharmacies")}</p>
          )}
        </div>
      </section>


      <section className="px-4 py-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t("quick_access")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            const cls =
              tile.tone === "primary"
                ? "bg-primary text-primary-foreground"
                : tile.tone === "emergency"
                  ? "bg-emergency text-emergency-foreground"
                  : "bg-card text-foreground border border-border";
            return (
              <Link
                key={tile.to}
                to={tile.to}
                className={
                  "group flex aspect-square flex-col justify-between rounded-2xl p-4 shadow-card transition-transform active:scale-[0.98] " +
                  cls
                }
              >
                <Icon className="h-7 w-7" />
                <div className="flex items-end justify-between">
                  <span className="text-base font-bold leading-tight">{tile.label}</span>
                  <ChevronRight className="h-4 w-4 opacity-70" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
