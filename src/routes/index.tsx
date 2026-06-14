import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Pill, MapPin, Phone, Search, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useZone } from "@/lib/zone-store";
import { useZones } from "@/lib/supabase-hooks";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { t } = useLang();
  const { zone, setZone } = useZone();
  const { zones, loading } = useZones();

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
